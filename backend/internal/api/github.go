package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// githubTokenStore holds in-memory GitHub OAuth tokens keyed by state/wallet.
// For production you'd persist these in the DB, but in-memory is fine for the demo.
var githubTokenStore = &tokenStore{tokens: map[string]string{}}

type tokenStore struct {
	mu     sync.RWMutex
	tokens map[string]string // wallet_address → github_access_token
	states map[string]string // oauth_state → wallet_address (pending)
}

func (t *tokenStore) saveState(state, wallet string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.states == nil {
		t.states = map[string]string{}
	}
	t.states[state] = wallet
}

func (t *tokenStore) resolveState(state string) (wallet string, ok bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	wallet, ok = t.states[state]
	if ok {
		delete(t.states, state)
	}
	return
}

func (t *tokenStore) set(wallet, token string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.tokens[wallet] = token
}

func (t *tokenStore) get(wallet string) (string, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	tok, ok := t.tokens[wallet]
	return tok, ok
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

// GET /auth/github?wallet=0x...
// Redirects the browser to GitHub OAuth. wallet is stored in the state so we
// can associate the token with the right user on callback.
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

	// Use wallet as state (good enough for a hackathon — production should use a CSRF token)
	state := fmt.Sprintf("%s-%d", wallet, time.Now().UnixNano())
	githubTokenStore.saveState(state, wallet)

	redirect := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=repo&state=%s",
		url.QueryEscape(s.githubClientID),
		url.QueryEscape(s.githubCallbackURL),
		url.QueryEscape(state),
	)
	http.Redirect(w, r, redirect, http.StatusFound)
}

// GET /auth/github/callback?code=...&state=...
// GitHub redirects here after the user approves. Exchanges code for token,
// stores it, then redirects back with the token for the frontend to use.
func (s *Server) githubOAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	wallet, ok := githubTokenStore.resolveState(state)
	if !ok {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}

	// Exchange code for token
	token, err := exchangeGitHubCode(r.Context(), s.githubClientID, s.githubClientSecret, code, s.githubCallbackURL)
	if err != nil {
		http.Error(w, "token exchange failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	githubTokenStore.set(wallet, token)

	// Return JSON (frontend can also be redirected here)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"wallet":       wallet,
		"github_token": token,
		"status":       "connected",
	})
}

// GET /auth/github/repos?wallet=0x...
// Returns the list of repos accessible with the stored token.
func (s *Server) githubListRepos(w http.ResponseWriter, r *http.Request) {
	wallet := r.URL.Query().Get("wallet")
	if wallet == "" {
		http.Error(w, "wallet required", http.StatusBadRequest)
		return
	}
	token, ok := githubTokenStore.get(wallet)
	if !ok {
		http.Error(w, "github not connected for this wallet — call GET /auth/github?wallet=...", http.StatusUnauthorized)
		return
	}

	repos, err := fetchGitHubRepos(r.Context(), token)
	if err != nil {
		http.Error(w, "fetch repos failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	jsonResponse(w, http.StatusOK, repos)
}

// exchangeGitHubCode trades an OAuth code for an access token.
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

	// GitHub returns application/x-www-form-urlencoded
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

// fetchGitHubRepos calls GET /user/repos with the given token.
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
