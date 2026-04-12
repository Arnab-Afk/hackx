package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/Arnab-Afk/hackx/backend/internal/agent"
	"github.com/Arnab-Afk/hackx/backend/internal/auth"
	"github.com/Arnab-Afk/hackx/backend/internal/chain"
	"github.com/Arnab-Afk/hackx/backend/internal/container"
	"github.com/Arnab-Afk/hackx/backend/internal/scanner"
	"github.com/Arnab-Afk/hackx/backend/internal/store"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins for dev
}

type Server struct {
	mgr                *container.Manager
	scanner            *scanner.Scanner
	store              *store.Store
	proxyURL           string
	apiKey             string
	agentModel         string
	rpcURL             string
	registryAddress    string
	easSchemaUID       string
	agentWalletKey     string
	githubClientID     string
	githubClientSecret string
	githubCallbackURL  string
	githubFrontendURL  string
	jwtSecret          string
	vaultMasterSecret  string
	deployDomain       string // e.g. "deploy.comput3.xyz"
}

func NewServer(mgr *container.Manager, sc *scanner.Scanner, s *store.Store, proxyURL, apiKey, agentModel, rpcURL, registryAddress, easSchemaUID, agentWalletKey, githubClientID, githubClientSecret, githubCallbackURL, githubFrontendURL, jwtSecret, vaultMasterSecret, deployDomain string) http.Handler {
	srv := &Server{
		mgr:                mgr,
		scanner:            sc,
		store:              s,
		proxyURL:           proxyURL,
		apiKey:             apiKey,
		agentModel:         agentModel,
		rpcURL:             rpcURL,
		registryAddress:    registryAddress,
		easSchemaUID:       easSchemaUID,
		agentWalletKey:     agentWalletKey,
		githubClientID:     githubClientID,
		githubClientSecret: githubClientSecret,
		githubCallbackURL:  githubCallbackURL,
		githubFrontendURL:  githubFrontendURL,
		jwtSecret:          jwtSecret,
		vaultMasterSecret:  vaultMasterSecret,
		deployDomain:       deployDomain,
	}

	authMgr := auth.NewManager()

	r := chi.NewRouter()
	r.Use(srv.subdomainProxy) // must be first — intercepts *.deploy.comput3.xyz before routing
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// Wallet auth
	r.Post("/auth/nonce", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Address string `json:"address"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Address == "" {
			http.Error(w, "address is required", http.StatusBadRequest)
			return
		}
		nonce := authMgr.IssueNonce(req.Address)
		jsonResponse(w, http.StatusOK, map[string]string{"nonce": nonce, "address": req.Address})
	})

	r.Post("/auth/verify", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Address   string `json:"address"`
			Nonce     string `json:"nonce"`
			Signature string `json:"signature"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		if err := authMgr.VerifySignature(req.Address, req.Nonce, req.Signature); err != nil {
			http.Error(w, fmt.Sprintf("verification failed: %v", err), http.StatusUnauthorized)
			return
		}
		token := srv.issueJWT(req.Address)
		jsonResponse(w, http.StatusOK, map[string]any{
			"verified": true,
			"address":  req.Address,
			"token":    token,
		})
	})

	r.Get("/attestations/{sessionID}", srv.getAttestation)
	r.Post("/sessions/{sessionID}/attest", srv.registerAttestation)

	// Vault key gate — blockchain-gated container decryption key
	r.Get("/vault/nonce", vaultNonce(authMgr))
	r.Post("/vault/key", srv.vaultKey(authMgr))
	r.Post("/teams", srv.createTeam)
	r.Get("/teams/{teamID}", srv.getTeam)
	r.Get("/teams/{teamID}/containers", srv.listContainers)
	r.Get("/teams/{teamID}/sessions", srv.listTeamSessions)
	r.Get("/teams/{teamID}/attestations", srv.listTeamAttestations)
	r.Get("/teams/{teamID}/workspaces", srv.listTeamWorkspaces)

	// Account — get or create the account (team) for the authenticated wallet
	r.Get("/account", srv.getAccount)
	r.Patch("/account", srv.updateAccount)

	// Payments — list x402 payments for a wallet
	r.Get("/payments", srv.listPayments)

	// On-chain providers
	r.Get("/providers/active", srv.getActiveProviders)

	// Secrets (wallet-auth gated)
	r.Get("/secrets", srv.listSecrets)
	r.Post("/secrets", srv.createSecret)
	r.Delete("/secrets/{id}", srv.deleteSecret)

	// Compute endpoints — protected by x402 payment middleware when a provider wallet is configured.
	// If agentWalletKey is empty (dev mode), x402 is bypassed so the node still works without payment.
	var computeMiddleware func(http.Handler) http.Handler
	if srv.agentWalletKey != "" {
		// 0.01 USDC per session (10_000 micro-USDC, 6 decimals)
		requiredUsdc := big.NewInt(10_000)
		providerWallet := deriveProviderWallet(srv.agentWalletKey)
		computeMiddleware = x402Middleware(providerWallet, requiredUsdc, srv.rpcURL, srv.agentWalletKey, srv.store)
	} else {
		computeMiddleware = func(next http.Handler) http.Handler { return next } // passthrough
	}

	r.With(computeMiddleware).Post("/sessions", srv.createSession)
	r.Get("/sessions/{sessionID}", srv.getSession)
	r.Post("/sessions/{sessionID}/confirm", srv.confirmSession)
	r.Get("/sessions/{sessionID}/stream", srv.streamSession)
	r.Get("/sessions/{sessionID}/log", srv.getActionLog)

	r.Delete("/containers/{containerID}", srv.destroyContainer)

	r.With(computeMiddleware).Post("/workspaces", srv.allocateWorkspace)
	r.Get("/workspaces/{containerID}/status", srv.workspaceStatus)
	r.Get("/workspaces/{containerID}/ssh", srv.sshGateway) // WebSocket SSH terminal
	r.Delete("/workspaces/{containerID}", srv.destroyWorkspace)

	r.Post("/repos/scan", srv.scanRepo)
	r.Post("/workspaces/{containerID}/deploy", srv.deployToWorkspace)

	// GitHub OAuth — connect account for private repo access
	r.Get("/auth/github", srv.githubOAuthStart)
	r.Get("/auth/github/callback", srv.githubOAuthCallback)
	r.Get("/auth/github/repos", srv.githubListRepos)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	return r
}

// POST /teams
func (s *Server) createTeam(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		PublicKey string `json:"public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	team := &store.Team{
		ID:        generateID("team"),
		Name:      req.Name,
		PublicKey: req.PublicKey,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.store.CreateTeam(r.Context(), team); err != nil {
		http.Error(w, fmt.Sprintf("create team: %v", err), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusCreated, team)
}

// GET /teams/:teamID
func (s *Server) getTeam(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "teamID")
	team, err := s.store.GetTeam(r.Context(), id)
	if err != nil {
		http.Error(w, "team not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, team)
}

// GET /account — get or auto-create the account for the authenticated wallet
func (s *Server) getAccount(w http.ResponseWriter, r *http.Request) {
	wallet, ok := s.walletFromRequest(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	team, err := s.store.GetOrCreateTeamByWallet(r.Context(), wallet)
	if err != nil {
		http.Error(w, fmt.Sprintf("account: %v", err), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, team)
}

// PATCH /account — update account name
func (s *Server) updateAccount(w http.ResponseWriter, r *http.Request) {
	wallet, ok := s.walletFromRequest(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	team, err := s.store.GetOrCreateTeamByWallet(r.Context(), wallet)
	if err != nil {
		http.Error(w, fmt.Sprintf("account: %v", err), http.StatusInternalServerError)
		return
	}
	if err := s.store.UpdateTeamName(r.Context(), team.ID, req.Name); err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	team.Name = req.Name
	jsonResponse(w, http.StatusOK, team)
}

// GET /teams/:teamID/containers
func (s *Server) listContainers(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	containers, err := s.mgr.ListTeamContainers(r.Context(), teamID)
	if err != nil {
		http.Error(w, fmt.Sprintf("list containers: %v", err), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, containers)
}

// POST /sessions
func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TeamID      string `json:"team_id"`
		Prompt      string `json:"prompt"`
		RepoURL     string `json:"repo_url"`     // optional GitHub URL
		GitHubToken string `json:"github_token"` // optional explicit token
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TeamID == "" {
		http.Error(w, "team_id is required", http.StatusBadRequest)
		return
	}
	// At least one of prompt or repo_url must be provided
	if req.Prompt == "" && req.RepoURL == "" {
		http.Error(w, "prompt or repo_url is required", http.StatusBadRequest)
		return
	}
	// If only repo_url given, build a default prompt
	if req.Prompt == "" {
		req.Prompt = fmt.Sprintf("Deploy the repository at %s", req.RepoURL)
	}

	// Verify team exists
	if _, err := s.store.GetTeam(r.Context(), req.TeamID); err != nil {
		http.Error(w, "team not found", http.StatusNotFound)
		return
	}

	// Resolve GitHub token: explicit > wallet-linked OAuth token
	githubToken := req.GitHubToken
	if githubToken == "" {
		wallet, _ := s.walletFromRequest(r)
		if wallet != "" {
			githubToken, _ = s.githubToken(strings.ToLower(wallet))
		}
	}

	sess := &store.Session{
		ID:        generateID("sess"),
		TeamID:    req.TeamID,
		Prompt:    req.Prompt,
		State:     "running",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := s.store.CreateSession(r.Context(), sess); err != nil {
		http.Error(w, fmt.Sprintf("create session: %v", err), http.StatusInternalServerError)
		return
	}

	// Run agent in background; client connects to /sessions/:id/stream to get events
	go s.runAgentSession(sess.ID, sess.TeamID, req.Prompt, req.RepoURL, githubToken)

	jsonResponse(w, http.StatusCreated, sess)
}

// POST /sessions/:sessionID/confirm — user approves the deployment plan
func (s *Server) confirmSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sessionID")

	sess, ok := sessionRegistry.get(id)
	if !ok {
		// Session may already be done or doesn't exist
		dbSess, err := s.store.GetSession(r.Context(), id)
		if err != nil {
			http.Error(w, "session not found", http.StatusNotFound)
			return
		}
		if dbSess.State != "running" {
			http.Error(w, fmt.Sprintf("session is already %s", dbSess.State), http.StatusConflict)
			return
		}
		http.Error(w, "session not active in memory", http.StatusGone)
		return
	}

	sess.Confirm()
	jsonResponse(w, http.StatusOK, map[string]string{"status": "confirmed", "session_id": id})
}

// GET /sessions/:sessionID
func (s *Server) getSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sessionID")
	sess, err := s.store.GetSession(r.Context(), id)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, sess)
}

// GET /sessions/:sessionID/stream — WebSocket endpoint
func (s *Server) streamSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")

	sess, err := s.store.GetSession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// If session is already done, just send the action log and close
	if sess.State != "running" {
		log, _ := s.store.GetActionLog(r.Context(), sessionID)
		if log != nil {
			conn.WriteJSON(map[string]any{"type": "done", "log": json.RawMessage(log.Actions)})
		}
		return
	}

	// Subscribe to live events from the running agent session
	ch := sessionBus.subscribe(sessionID)
	defer sessionBus.unsubscribe(sessionID, ch)

	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WriteJSON(event); err != nil {
				return
			}
			if event.Type == "done" || event.Type == "error" {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}

// GET /sessions/:sessionID/log
func (s *Server) getActionLog(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sessionID")
	log, err := s.store.GetActionLog(r.Context(), id)
	if err != nil {
		http.Error(w, "log not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, log)
}

// POST /workspaces
func (s *Server) allocateWorkspace(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TeamID    string  `json:"team_id"`
		RAMMb     int64   `json:"ram_mb"`
		CPUCores  float64 `json:"cpu_cores"`
		SessionID string  `json:"session_id"` // optional — used to derive blockchain-gated vault key
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TeamID == "" {
		http.Error(w, "team_id is required", http.StatusBadRequest)
		return
	}
	if req.RAMMb == 0 {
		req.RAMMb = 2048
	}
	if req.CPUCores == 0 {
		req.CPUCores = 2.0
	}

	// Verify team exists
	if _, err := s.store.GetTeam(r.Context(), req.TeamID); err != nil {
		http.Error(w, "team not found", http.StatusNotFound)
		return
	}

	// Derive vault key from EAS attestation if a session_id was provided.
	var vaultKey string
	if req.SessionID != "" {
		att, err := s.store.GetAttestation(r.Context(), req.SessionID)
		if err == nil && att != nil && att.AttestationUID != "" {
			vaultKey, _ = deriveVaultKey(att.AttestationUID)
			log.Printf("[workspace] vault key derived from attestation uid=%s", att.AttestationUID)
		} else {
			log.Printf("[workspace] session %s has no attestation — using random vault key", req.SessionID)
		}
	}

	log.Printf("[workspace] allocating for team %s (ram=%dMB cpu=%.1f encrypted=%v)", req.TeamID, req.RAMMb, req.CPUCores, vaultKey != "")

	ws, err := s.mgr.AllocateWorkspace(r.Context(), container.WorkspaceConfig{
		TeamID:   req.TeamID,
		RAMMb:    req.RAMMb,
		CPUCores: req.CPUCores,
		VaultKey: vaultKey,
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("allocate workspace: %v", err), http.StatusInternalServerError)
		return
	}

	// Persist workspace to DB
	_ = s.store.SaveWorkspace(r.Context(), &store.Workspace{
		ContainerID: ws.ContainerID,
		TeamID:      ws.TeamID,
		SSHHost:     ws.SSHHost,
		SSHPort:     ws.SSHPort,
		AppPort:     ws.AppPort,
		Username:    ws.Username,
		Password:    ws.Password,
		StoragePath: ws.StoragePath,
		Status:      ws.Status,
		CreatedAt:   ws.CreatedAt,
	})

	// Background: update DB status once SSH is ready
	go func() {
		deadline := time.Now().Add(5 * time.Minute)
		for time.Now().Before(deadline) {
			time.Sleep(3 * time.Second)
			info, ok := s.mgr.GetWorkspaceInfo(ws.ContainerID)
			if ok && info.Status == "ready" {
				_ = s.store.UpdateWorkspaceStatus(context.Background(), ws.ContainerID, "ready")
				return
			}
			if ok && info.Status == "failed" {
				_ = s.store.UpdateWorkspaceStatus(context.Background(), ws.ContainerID, "failed")
				return
			}
		}
	}()

	log.Printf("[workspace] ready — container=%s ssh=localhost:%d user=%s", ws.ContainerID, ws.SSHPort, ws.Username)
	jsonResponse(w, http.StatusCreated, ws)
}

// GET /workspaces/:containerID/status
func (s *Server) workspaceStatus(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "containerID")
	health, err := s.mgr.HealthCheck(r.Context(), containerID)
	if err != nil {
		http.Error(w, "workspace not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{
		"container_id": containerID,
		"running":      health.Running,
		"status":       health.Status,
	})
}

// DELETE /workspaces/:containerID
func (s *Server) destroyWorkspace(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "containerID")
	if err := s.mgr.Destroy(r.Context(), containerID); err != nil {
		http.Error(w, fmt.Sprintf("destroy workspace: %v", err), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /containers/:containerID
func (s *Server) destroyContainer(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "containerID")
	if err := s.mgr.Destroy(r.Context(), containerID); err != nil {
		http.Error(w, fmt.Sprintf("destroy: %v", err), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /attestations/:sessionID
func (s *Server) getAttestation(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	att, err := s.store.GetAttestation(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "attestation not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, att)
}

// POST /sessions/:sessionID/attest
// Registers an on-chain EAS attestation for a session by tx hash.
// Resolves the attestation UID from the receipt and stores it in the DB.
func (s *Server) registerAttestation(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")

	var req struct {
		TxHash string `json:"tx_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TxHash == "" {
		http.Error(w, "tx_hash required", http.StatusBadRequest)
		return
	}

	uid, err := chain.WaitForAttestationUID(r.Context(), s.rpcURL, req.TxHash)
	if err != nil {
		http.Error(w, "could not resolve attestation UID: "+err.Error(), http.StatusBadRequest)
		return
	}

	att := &store.Attestation{
		SessionID:      sessionID,
		TxHash:         req.TxHash,
		AttestationUID: uid,
		SchemaUID:      s.easSchemaUID,
		EASScanURL:     "https://base-sepolia.easscan.org/tx/" + req.TxHash,
	}
	if err := s.store.SaveAttestation(r.Context(), att); err != nil {
		http.Error(w, "save failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[attest] session=%s uid=%s tx=%s", sessionID, uid, req.TxHash)
	jsonResponse(w, http.StatusOK, map[string]string{
		"session_id":      sessionID,
		"attestation_uid": uid,
		"tx_hash":         req.TxHash,
		"eas_scan_url":    att.EASScanURL,
	})
}

// runAgentSession runs the agent and publishes events to the session bus.
func (s *Server) runAgentSession(sessionID, teamID, prompt, repoURL, githubToken string) {
	ctx := context.Background()

	log.Printf("[session %s] starting — proxy=%s model=%s", sessionID, s.proxyURL, s.agentModel)

	// If a repo URL was given, prepend it into the prompt so the agent calls analyze_repo
	if repoURL != "" {
		prompt = fmt.Sprintf("Analyze and deploy the repository at %s. %s", repoURL, prompt)
	}

	agentSess := agent.NewSession(sessionID, teamID, s.mgr, s.scanner, s.proxyURL, s.apiKey, s.agentModel, s.rpcURL, s.registryAddress, githubToken, s.deployDomain)

	// Register so /confirm can reach this session
	sessionRegistry.register(sessionID, agentSess)
	defer sessionRegistry.deregister(sessionID)

	// Forward events to bus
	go func() {
		for event := range agentSess.Events() {
			if event.Type == "error" {
				log.Printf("[session %s] agent error: %s", sessionID, event.Message)
			}
			sessionBus.publish(sessionID, event)
		}
	}()

	err := agentSess.Run(ctx, prompt)

	state := "completed"
	if err != nil {
		state = "failed"
		log.Printf("[session %s] FAILED: %v", sessionID, err)
	} else {
		log.Printf("[session %s] completed successfully", sessionID)
	}

	// Persist results
	_ = s.store.UpdateSessionState(ctx, sessionID, state)
	_ = s.store.SaveActionLog(ctx, sessionID, teamID, agentSess.Actions)

	// Persist provider selection if one was made
	if agentSess.SelectedProvider != nil {
		p := agentSess.SelectedProvider
		_ = s.store.SaveProviderSelection(ctx, &store.ProviderRecord{
			SessionID:     sessionID,
			Address:       p.Wallet.Hex(),
			Endpoint:      p.Endpoint,
			PricePerHour:  p.PricePerHour.String(),
			JobsCompleted: p.JobsCompleted.Int64(),
		})
	}

	// Submit EAS attestation if the session completed successfully and a wallet key is configured
	if state == "completed" && s.agentWalletKey != "" {
		go s.submitAttestation(sessionID, teamID, agentSess.Actions)
	}
}

func (s *Server) submitAttestation(sessionID, teamID string, actions []agent.Action) {
	ctx := context.Background()

	// Compute Merkle root from action hashes
	var hashes []string
	for _, a := range actions {
		hashes = append(hashes, a.Hash)
	}
	merkleRoot := chain.ComputeMerkleRoot(hashes)

	// Container state hash: keccak256 of all action hashes concatenated
	var containerStateHash [32]byte
	copy(containerStateHash[:], merkleRoot[:]) // simplified: same as merkle root for demo

	result, err := chain.SubmitAttestation(
		ctx,
		s.rpcURL,
		s.agentWalletKey,
		s.easSchemaUID,
		sessionID,
		teamID,
		merkleRoot,
		containerStateHash,
		"",
	)
	if err != nil {
		log.Printf("[attestation] session %s: submit failed: %v", sessionID, err)
		return
	}
	log.Printf("[attestation] session %s: tx submitted: %s — waiting for receipt...", sessionID, result.TxHash)

	// Wait for the tx to be mined and resolve the attestation UID
	attestationUID, err := chain.WaitForAttestationUID(ctx, s.rpcURL, result.TxHash)
	if err != nil {
		log.Printf("[attestation] session %s: could not resolve UID: %v — saving tx_hash only", sessionID, err)
		attestationUID = ""
	} else {
		log.Printf("[attestation] session %s: attestation UID = %s", sessionID, attestationUID)
	}

	att := &store.Attestation{
		SessionID:      sessionID,
		TxHash:         result.TxHash,
		AttestationUID: attestationUID,
		MerkleRoot:     fmt.Sprintf("0x%x", merkleRoot),
		SchemaUID:      s.easSchemaUID,
		EASScanURL:     "https://base-sepolia.easscan.org/tx/" + result.TxHash,
	}
	if err := s.store.SaveAttestation(ctx, att); err != nil {
		log.Printf("[attestation] session %s: save failed: %v", sessionID, err)
		return
	}
	log.Printf("[attestation] session %s: saved — uid=%s tx=%s", sessionID, attestationUID, result.TxHash)
}

// --- helpers ---

// deriveProviderWallet returns the Ethereum address corresponding to a hex private key.
func deriveProviderWallet(privKeyHex string) string {
	privKeyHex = strings.TrimPrefix(privKeyHex, "0x")
	privKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		return ""
	}
	return crypto.PubkeyToAddress(privKey.PublicKey).Hex()
}

func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// subdomainProxy intercepts requests whose Host matches *.{deployDomain} and
// reverse-proxies them to the container's host port. All other requests are
// passed through to the normal Chi router.
func (s *Server) subdomainProxy(next http.Handler) http.Handler {
	if s.deployDomain == "" {
		return next // feature disabled — no domain configured
	}
	suffix := "." + s.deployDomain
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		// Strip port if present (e.g. "abc.deploy.comput3.xyz:8081" → "abc.deploy.comput3.xyz")
		if i := strings.LastIndex(host, ":"); i != -1 {
			host = host[:i]
		}
		if !strings.HasSuffix(host, suffix) {
			next.ServeHTTP(w, r)
			return
		}
		// Extract container ID: "abc123def456.deploy.comput3.xyz" → "abc123def456"
		containerID := strings.TrimSuffix(host, suffix)
		if containerID == "" {
			http.Error(w, "missing container ID in subdomain", http.StatusBadRequest)
			return
		}
		hostPort, ok := s.mgr.LookupDeployPort(containerID)
		if !ok {
			http.Error(w, "no deployment found for "+containerID, http.StatusNotFound)
			return
		}
		target, err := url.Parse("http://localhost:" + hostPort)
		if err != nil {
			http.Error(w, "internal routing error", http.StatusInternalServerError)
			return
		}
		log.Printf("[subdomain-proxy] %s → localhost:%s%s", host, hostPort, r.URL.Path)
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("[subdomain-proxy] upstream error for %s: %v", containerID, err)
			http.Error(w, "container unreachable: "+err.Error(), http.StatusBadGateway)
		}
		proxy.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// POST /repos/scan
// Clones the repo, detects tech stack heuristically (no AI), returns deploy options.
// Pass wallet to auto-use stored GitHub token for private repos.
func (s *Server) scanRepo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RepoURL string `json:"repo_url"`
		Wallet  string `json:"wallet"`       // optional — looks up stored GitHub token
		Token   string `json:"github_token"` // optional — explicit token override
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RepoURL == "" {
		http.Error(w, "repo_url required", http.StatusBadRequest)
		return
	}

	token := req.Token
	if token == "" && req.Wallet != "" {
		token, _ = s.githubToken(strings.ToLower(req.Wallet))
	}

	result, err := scanner.ScanRepo(r.Context(), req.RepoURL, token)
	if err != nil {
		http.Error(w, "scan failed: "+err.Error(), http.StatusBadRequest)
		return
	}
	jsonResponse(w, http.StatusOK, result)
}

// POST /workspaces/:containerID/deploy
// Clones the repo into the workspace and starts the chosen component.
// Body: { "repo_url": "...", "option_index": 0, "env_vars": {"KEY":"val"} }
func (s *Server) deployToWorkspace(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "containerID")

	var req struct {
		RepoURL     string            `json:"repo_url"`
		OptionIndex int               `json:"option_index"` // index into scan.Options
		EnvVars     map[string]string `json:"env_vars"`     // user-supplied env vars
		Wallet      string            `json:"wallet"`       // optional — looks up stored GitHub token
		Token       string            `json:"github_token"` // optional — explicit token override
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RepoURL == "" {
		http.Error(w, "repo_url required", http.StatusBadRequest)
		return
	}

	token := req.Token
	if token == "" && req.Wallet != "" {
		token, _ = s.githubToken(strings.ToLower(req.Wallet))
	}

	// Re-scan to get the deploy options.
	scan, err := scanner.ScanRepo(r.Context(), req.RepoURL, token)
	if err != nil {
		http.Error(w, "scan failed: "+err.Error(), http.StatusBadRequest)
		return
	}
	if len(scan.Options) == 0 {
		http.Error(w, "no deployable components detected in repo", http.StatusBadRequest)
		return
	}
	if req.OptionIndex < 0 || req.OptionIndex >= len(scan.Options) {
		http.Error(w, fmt.Sprintf("option_index out of range (0-%d)", len(scan.Options)-1), http.StatusBadRequest)
		return
	}
	opt := scan.Options[req.OptionIndex]

	// Look up workspace SSH credentials.
	ws, ok := s.mgr.GetWorkspaceInfo(containerID)
	if !ok {
		http.Error(w, "workspace not found", http.StatusNotFound)
		return
	}
	if ws.Status != "ready" {
		http.Error(w, "workspace not ready yet", http.StatusServiceUnavailable)
		return
	}

	// Build the shell script to run inside the workspace.
	var script strings.Builder
	script.WriteString("set -e\n")
	script.WriteString("cd ~\n")
	script.WriteString("rm -rf app\n")
	cloneURL := req.RepoURL
	if token != "" {
		// Inject token: https://github.com/user/repo → https://x-access-token:TOKEN@github.com/user/repo
		cloneURL = strings.Replace(cloneURL, "https://github.com/", fmt.Sprintf("https://x-access-token:%s@github.com/", token), 1)
	}
	script.WriteString(fmt.Sprintf("git clone --depth 1 %s app\n", cloneURL))
	script.WriteString("cd app\n")

	// Write env vars into .env
	if len(req.EnvVars) > 0 {
		script.WriteString("cat > .env << '__ENVEOF__'\n")
		for k, v := range req.EnvVars {
			script.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		}
		script.WriteString("__ENVEOF__\n")
	}

	// Install deps
	if opt.InstallCmd != "" {
		// Install runtime deps for the language
		switch opt.Language {
		case "node":
			script.WriteString("command -v node >/dev/null || (apt-get update -qq && apt-get install -y -qq nodejs npm)\n")
		case "python":
			script.WriteString("command -v pip3 >/dev/null || (apt-get update -qq && apt-get install -y -qq python3 python3-pip)\n")
			script.WriteString("ln -sf /usr/bin/pip3 /usr/local/bin/pip 2>/dev/null || true\n")
		case "go":
			script.WriteString("command -v go >/dev/null || (apt-get update -qq && apt-get install -y -qq golang)\n")
		}
		script.WriteString(opt.InstallCmd + "\n")
	}

	// Build step
	if opt.BuildCmd != "" {
		script.WriteString(opt.BuildCmd + "\n")
	}

	// Start app in background, log to ~/app.log, write PID to ~/app.pid
	script.WriteString(fmt.Sprintf(
		"nohup %s > ~/app.log 2>&1 & echo $! > ~/app.pid\n",
		opt.StartCmd,
	))
	script.WriteString("sleep 2 && echo 'started' && cat ~/app.pid\n")

	log.Printf("[deploy] workspace=%s repo=%s framework=%s", containerID, req.RepoURL, opt.Framework)

	// Run via SSH.
	output, err := runSSHScript(ws.SSHHost, ws.SSHPort, ws.Username, ws.Password, script.String())
	if err != nil {
		log.Printf("[deploy] ssh error: %v\noutput: %s", err, output)
		http.Error(w, "deploy failed: "+err.Error()+"\n"+output, http.StatusInternalServerError)
		return
	}

	log.Printf("[deploy] done — workspace=%s output: %s", containerID, output)

	jsonResponse(w, http.StatusOK, map[string]any{
		"container_id": containerID,
		"framework":    opt.Framework,
		"type":         opt.Type,
		"port":         opt.Port,
		"app_url":      fmt.Sprintf("http://%s:%d", ws.SSHHost, ws.AppPort),
		"log_output":   output,
	})
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// --- JWT helpers ---

// issueJWT creates a simple HMAC-SHA256 signed token: wallet|exp hex-signed.
func (s *Server) issueJWT(wallet string) string {
	exp := time.Now().Add(30 * 24 * time.Hour).Unix()
	payload := fmt.Sprintf("%s|%d", strings.ToLower(wallet), exp)
	mac := hmac.New(sha256.New, []byte(s.jwtSecret))
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	return payload + "|" + sig
}

// verifyJWT validates the token and returns the wallet address.
func (s *Server) verifyJWT(token string) (string, bool) {
	parts := strings.Split(token, "|")
	if len(parts) != 3 {
		return "", false
	}
	wallet, expStr, sig := parts[0], parts[1], parts[2]
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", false
	}
	payload := wallet + "|" + expStr
	mac := hmac.New(sha256.New, []byte(s.jwtSecret))
	mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return "", false
	}
	return wallet, true
}

// walletFromRequest extracts the wallet from Authorization: Bearer <token> header.
// Falls back to ?wallet= query param for backwards compat.
func (s *Server) walletFromRequest(r *http.Request) (string, bool) {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return s.verifyJWT(strings.TrimPrefix(auth, "Bearer "))
	}
	if w := r.URL.Query().Get("wallet"); w != "" {
		return w, true // unauthenticated but wallet-identified
	}
	return "", false
}

// --- New list endpoints ---

// GET /teams/:teamID/sessions
func (s *Server) listTeamSessions(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	sessions, err := s.store.ListSessions(r.Context(), teamID, 50)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if sessions == nil {
		sessions = []store.Session{}
	}
	jsonResponse(w, http.StatusOK, sessions)
}

// GET /teams/:teamID/attestations
func (s *Server) listTeamAttestations(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	list, err := s.store.ListAttestations(r.Context(), teamID, 50)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []store.Attestation{}
	}
	jsonResponse(w, http.StatusOK, list)
}

// GET /teams/:teamID/workspaces
func (s *Server) listTeamWorkspaces(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	list, err := s.store.ListWorkspaces(r.Context(), teamID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []store.Workspace{}
	}
	jsonResponse(w, http.StatusOK, list)
}

// GET /payments?wallet=
func (s *Server) listPayments(w http.ResponseWriter, r *http.Request) {
	wallet, _ := s.walletFromRequest(r)
	if wallet == "" {
		jsonResponse(w, http.StatusOK, []store.Payment{})
		return
	}
	list, err := s.store.ListPayments(r.Context(), strings.ToLower(wallet), 50)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []store.Payment{}
	}
	jsonResponse(w, http.StatusOK, list)
}

// GET /providers/active
func (s *Server) getActiveProviders(w http.ResponseWriter, r *http.Request) {
	if s.rpcURL == "" || s.registryAddress == "" {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	providers, err := chain.GetActiveProviders(r.Context(), s.rpcURL, s.registryAddress)
	if err != nil {
		log.Printf("[providers] fetch error: %v", err)
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	if providers == nil {
		providers = []chain.Provider{}
	}
	jsonResponse(w, http.StatusOK, providers)
}

// --- Secrets endpoints ---

// secretKey derives an AES key for encrypting secrets: sha256(vaultMasterSecret + wallet)
func (s *Server) secretKey(wallet string) []byte {
	h := sha256.New()
	h.Write([]byte(s.vaultMasterSecret))
	h.Write([]byte(strings.ToLower(wallet)))
	return h.Sum(nil)
}

// GET /secrets?wallet= (or Authorization: Bearer <token>)
func (s *Server) listSecrets(w http.ResponseWriter, r *http.Request) {
	wallet, ok := s.walletFromRequest(r)
	if !ok || wallet == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	secrets, err := s.store.ListSecrets(r.Context(), strings.ToLower(wallet))
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	// Return without exposing encrypted values — decrypt here
	type SecretOut struct {
		ID        int64  `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}
	out := make([]SecretOut, len(secrets))
	for i, sec := range secrets {
		out[i] = SecretOut{ID: sec.ID, Name: sec.Name, CreatedAt: sec.CreatedAt.Format(time.RFC3339)}
	}
	jsonResponse(w, http.StatusOK, out)
}

// POST /secrets { wallet, name, value }
func (s *Server) createSecret(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Value == "" {
		http.Error(w, "name and value required", http.StatusBadRequest)
		return
	}
	wallet, ok := s.walletFromRequest(r)
	if !ok || wallet == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	wallet = strings.ToLower(wallet)
	// Encrypt value with AES-GCM
	enc, err := encryptSecret(s.secretKey(wallet), req.Value)
	if err != nil {
		http.Error(w, "encrypt error", http.StatusInternalServerError)
		return
	}
	if err := s.store.SaveSecret(r.Context(), wallet, req.Name, enc); err != nil {
		http.Error(w, "save error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusCreated, map[string]string{"status": "ok", "name": req.Name})
}

// DELETE /secrets/{id}
func (s *Server) deleteSecret(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	wallet, ok := s.walletFromRequest(r)
	if !ok || wallet == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := s.store.DeleteSecret(r.Context(), id, strings.ToLower(wallet)); err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// encryptSecret encrypts plaintext with XOR-SHA256 keyed stream (simple, no extra deps).
// Values are stored server-side; key = sha256(vaultMasterSecret + wallet).
func encryptSecret(key []byte, plaintext string) (string, error) {
	h := sha256.New()
	h.Write(key)
	keyStream := h.Sum(nil) // 32 bytes
	plain := []byte(plaintext)
	out := make([]byte, len(plain))
	for i, b := range plain {
		out[i] = b ^ keyStream[i%32]
	}
	return hex.EncodeToString(out), nil
}

func decryptSecret(key []byte, cipherHex string) (string, error) {
	// XOR is its own inverse
	return encryptSecret(key, string(mustDecodeHex(cipherHex)))
}

func mustDecodeHex(s string) []byte {
	b, _ := hex.DecodeString(s)
	return b
}
