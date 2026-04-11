package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/Arnab-Afk/hackx/backend/internal/agent"
	"github.com/Arnab-Afk/hackx/backend/internal/container"
	"github.com/Arnab-Afk/hackx/backend/internal/scanner"
	"github.com/Arnab-Afk/hackx/backend/internal/store"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins for dev
}

type Server struct {
	mgr        *container.Manager
	scanner    *scanner.Scanner
	store      *store.Store
	proxyURL   string
	apiKey     string
	agentModel string
}

func NewServer(mgr *container.Manager, sc *scanner.Scanner, s *store.Store, proxyURL, apiKey, agentModel string) http.Handler {
	srv := &Server{mgr: mgr, scanner: sc, store: s, proxyURL: proxyURL, apiKey: apiKey, agentModel: agentModel}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Post("/teams", srv.createTeam)
	r.Get("/teams/{teamID}", srv.getTeam)
	r.Get("/teams/{teamID}/containers", srv.listContainers)

	r.Post("/sessions", srv.createSession)
	r.Get("/sessions/{sessionID}", srv.getSession)
	r.Get("/sessions/{sessionID}/stream", srv.streamSession)
	r.Get("/sessions/{sessionID}/log", srv.getActionLog)

	r.Delete("/containers/{containerID}", srv.destroyContainer)

	r.Post("/workspaces", srv.allocateWorkspace)
	r.Get("/workspaces/{containerID}/status", srv.workspaceStatus)
	r.Get("/workspaces/{containerID}/ssh", srv.sshGateway) // WebSocket SSH terminal
	r.Delete("/workspaces/{containerID}", srv.destroyWorkspace)

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
		TeamID  string `json:"team_id"`
		Prompt  string `json:"prompt"`
		RepoURL string `json:"repo_url"` // optional GitHub URL
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
	go s.runAgentSession(sess.ID, sess.TeamID, req.Prompt, req.RepoURL)

	jsonResponse(w, http.StatusCreated, sess)
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
		TeamID   string  `json:"team_id"`
		RAMMb    int64   `json:"ram_mb"`
		CPUCores float64 `json:"cpu_cores"`
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

	log.Printf("[workspace] allocating for team %s (ram=%dMB cpu=%.1f)", req.TeamID, req.RAMMb, req.CPUCores)

	ws, err := s.mgr.AllocateWorkspace(r.Context(), container.WorkspaceConfig{
		TeamID:   req.TeamID,
		RAMMb:    req.RAMMb,
		CPUCores: req.CPUCores,
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("allocate workspace: %v", err), http.StatusInternalServerError)
		return
	}

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

// runAgentSession runs the agent and publishes events to the session bus.
func (s *Server) runAgentSession(sessionID, teamID, prompt, repoURL string) {
	ctx := context.Background()

	log.Printf("[session %s] starting — proxy=%s model=%s", sessionID, s.proxyURL, s.agentModel)

	// If a repo URL was given, prepend it into the prompt so the agent calls analyze_repo
	if repoURL != "" {
		prompt = fmt.Sprintf("Analyze and deploy the repository at %s. %s", repoURL, prompt)
	}

	agentSess := agent.NewSession(sessionID, teamID, s.mgr, s.scanner, s.proxyURL, s.apiKey, s.agentModel)

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
}

// --- helpers ---

func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}
