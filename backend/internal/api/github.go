package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// oauthStateStore holds pending OAuth state→wallet mappings (in-memory is fine — short-lived).
var oauthStateStore = &stateMap{states: map[string]string{}}

type stateMap struct {
	mu     sync.Mutex
	states map[string]string
}

func (s *stateMap) save(state, wallet string) {
	s.mu.Lock()
	s.states[state] = wallet
	s.mu.Unlock()
}

func (s *stateMap) resolve(state string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.states[state]
	if ok {
		delete(s.states, state)
	}
	return w, ok
}

// GithubRepo is a single entry in the /user/repos response.
type GithubRepo struct {
	FullName    string    `json:"full_name"`
	Private     bool      `json:"private"`
	Description string    `json:"description"`
	HTMLURL     string    `json:"html_url"`
	CloneURL    string    `json:"clone_url"`
	UpdatedAt   time.Time `json:"updated_at"`
	Language    string    `json:"language"`
}

// githubToken looks up the stored GitHub token for a wallet from DB, falling back to in-memory.
func (s *Server) githubToken(wallet string) (string, bool) {
	tok, err := s.store.GetGitHubToken(context.Background(), strings.ToLower(wallet))
	if err == nil && tok != "" {
		return tok, true
	}
	return "", false
}

// GET /auth/github?wallet=0x...
func (s *Server) githubOAuthStart(w http.ResponseWriter, r *http.Request) {
	if s.githubClientID == "" {
		http.Error(w, "GitHub OAuth not configured (GITHUB_CLIENT_ID missing)", http.StatusServiceUnavailable)
		return
	}
	wallet := r.URL.Query().Get("wallet")
	if wallet == "" {
		http.Error(w, "wallet required", http.StatusBadRequest)
		return
	}

	state := fmt.Sprintf("%s-%d", wallet, time.Now().UnixNano())
	oauthStateStore.save(state, wallet)

	redirect := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=repo&state=%s",
		url.QueryEscape(s.githubClientID),
		url.QueryEscape(s.githubCallbackURL),
		url.QueryEscape(state),
	)
	http.Redirect(w, r, redirect, http.StatusFound)
}

// GET /auth/github/callback?code=...&state=...
func (s *Server) githubOAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	wallet, ok := oauthStateStore.resolve(state)
	if !ok {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}

	token, err := exchangeGitHubCode(r.Context(), s.githubClientID, s.githubClientSecret, code, s.githubCallbackURL)
	if err != nil {
		http.Error(w, "token exchange failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	// Persist to DB
	_ = s.store.SaveGitHubToken(r.Context(), strings.ToLower(wallet), token)

	frontendURL := s.githubFrontendURL + "?github=connected&wallet=" + url.QueryEscape(wallet)
	http.Redirect(w, r, frontendURL, http.StatusFound)
}

// GET /auth/github/repos?wallet=0x...
func (s *Server) githubListRepos(w http.ResponseWriter, r *http.Request) {
	wallet := r.URL.Query().Get("wallet")
	if wallet == "" {
		http.Error(w, "wallet required", http.StatusBadRequest)
		return
	}
	token, ok := s.githubToken(wallet)
	if !ok {
		http.Error(w, "github not connected — call GET /auth/github?wallet=...", http.StatusUnauthorized)
		return
	}

	repos, err := fetchGitHubRepos(r.Context(), token)
	if err != nil {
		http.Error(w, "fetch repos failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	jsonResponse(w, http.StatusOK, repos)
}

func exchangeGitHubCode(ctx context.Context, clientID, clientSecret, code, redirectURI string) (string, error) {
	resp, err := http.PostForm("https://github.com/login/oauth/access_token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	vals, err := url.ParseQuery(string(body))
	if err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	if errMsg := vals.Get("error_description"); errMsg != "" {
		return "", fmt.Errorf("%s", errMsg)
	}
	token := vals.Get("access_token")
	if token == "" {
		return "", fmt.Errorf("no access_token in response: %s", string(body))
	}
	return token, nil
}

func fetchGitHubRepos(ctx context.Context, token string) ([]GithubRepo, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/user/repos?per_page=100&sort=updated", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var repos []GithubRepo
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		return nil, err
	}
	return repos, nil
}


