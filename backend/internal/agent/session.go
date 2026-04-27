package agent

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Arnab-Afk/hackx/backend/internal/chain"
	"github.com/Arnab-Afk/hackx/backend/internal/container"
	"github.com/Arnab-Afk/hackx/backend/internal/scanner"
)

// Action represents a single tool call made by the agent.
type Action struct {
	Index     int            `json:"index"`
	Tool      string         `json:"tool"`
	Input     map[string]any `json:"input"`
	Result    any            `json:"result"`
	Error     string         `json:"error,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	Hash      string         `json:"hash"`
}

// SessionState represents the lifecycle state of an agent session.
type SessionState string

const (
	StateRunning   SessionState = "running"
	StateCompleted SessionState = "completed"
	StateFailed    SessionState = "failed"
)

// Event is streamed to the frontend over WebSocket.
type Event struct {
	Type        string  `json:"type"` // "action" | "message" | "plan" | "done" | "error"
	Action      *Action `json:"action,omitempty"`
	Message     string  `json:"message,omitempty"`
	Plan        any     `json:"plan,omitempty"`
	ContainerID string  `json:"container_id,omitempty"`
	DeployedURL string  `json:"deployed_url,omitempty"`
}

// Session manages one agent deployment conversation.
type Session struct {
	ID               string
	TeamID           string
	State            SessionState
	Actions          []Action
	Plan             *scanner.DeploymentPlan // set after analyze_repo
	SelectedProvider *chain.Provider         // set after select_provider

	mgr             *container.Manager
	scanner         *scanner.Scanner
	ollamaURL       string // Ollama base URL
	model           string // model for deployment agent
	events          chan Event
	rpcURL          string // Base Sepolia RPC URL
	registryAddress string // ProviderRegistry contract address
	confirmCh          chan struct{} // closed by Confirm() to unblock plan step
	githubToken        string       // optional — for private repo access
	lastContainerID    string       // ID of last container created (for deploy URL)
	deployDomain       string       // e.g. "deploy.comput3.xyz"
}

// anthropic API types (minimal)
type anthropicMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"` // string or []contentBlock
}

type contentBlock struct {
	Type      string         `json:"type"`
	Text      string         `json:"text,omitempty"`
	ID        string         `json:"id,omitempty"`
	Name      string         `json:"name,omitempty"`
	Input     map[string]any `json:"input,omitempty"`
	ToolUseID string         `json:"tool_use_id,omitempty"`
	Content   string         `json:"content,omitempty"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Tools     []map[string]any   `json:"tools"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicResponse struct {
	ID      string         `json:"id"`
	Type    string         `json:"type"`
	Content []contentBlock `json:"content"`
	Model   string         `json:"model"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	StopReason string `json:"stop_reason"`
}

func NewSession(id, teamID string, mgr *container.Manager, sc *scanner.Scanner, ollamaURL, model, rpcURL, registryAddress, githubToken, deployDomain string) *Session {
	if model == "" {
		model = "qwen2.5-coder"
	}
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}
	return &Session{
		ID:              id,
		TeamID:          teamID,
		State:           StateRunning,
		mgr:             mgr,
		scanner:         sc,
		ollamaURL:       ollamaURL,
		model:           model,
		events:          make(chan Event, 64),
		rpcURL:          rpcURL,
		registryAddress: registryAddress,
		confirmCh:       make(chan struct{}),
		githubToken:     githubToken,
		deployDomain:    deployDomain,
	}
}

// Confirm unblocks the agent if it is waiting for plan confirmation.
// Safe to call multiple times.
func (s *Session) Confirm() {
	select {
	case <-s.confirmCh:
		// already closed — no-op
	default:
		close(s.confirmCh)
	}
}

// Events returns a channel the caller can read events from.
func (s *Session) Events() <-chan Event {
	return s.events
}

// Run executes the agent loop for the given user prompt.
// It blocks until the agent is done or the context is cancelled.
func (s *Session) Run(ctx context.Context, userPrompt string) error {
	messages := []anthropicMessage{
		{Role: "user", Content: userPrompt},
	}
	consecutiveNoToolTurns := 0

	for {
		log.Printf("[session %s] calling ollama (turn %d)...", s.ID, len(messages))
		resp, err := s.callClaude(ctx, messages)
		if err != nil {
			log.Printf("[session %s] ollama error: %v", s.ID, err)
			s.State = StateFailed
			s.emit(Event{Type: "error", Message: err.Error()})
			return err
		}
		log.Printf("[session %s] ollama responded: stop_reason=%s blocks=%d", s.ID, resp.StopReason, len(resp.Content))

		// Collect any text blocks to stream to the user
		var assistantBlocks []contentBlock
		for _, block := range resp.Content {
			assistantBlocks = append(assistantBlocks, block)
			if block.Type == "text" && block.Text != "" {
				s.emit(Event{Type: "message", Message: block.Text})
			}
		}

		// Check whether there are any tool_use blocks — some proxies return
		// "end_turn" even when tools are being called, so we cannot rely on
		// StopReason alone.
		hasToolUse := false
		for _, block := range resp.Content {
			if block.Type == "tool_use" {
				hasToolUse = true
				break
			}
		}
		if !hasToolUse {
			consecutiveNoToolTurns++
			if consecutiveNoToolTurns <= 2 {
				s.emit(Event{Type: "message", Message: "Model returned text without tool calls; requesting tool-only response..."})
				messages = append(messages, anthropicMessage{Role: "user", Content: "Use at least one tool call now. Do not reply with plain text. If a GitHub URL exists, call analyze_repo first."})
				continue
			}

			// Hard fallback for first turn: bootstrap the expected initial tool sequence.
			if len(s.Actions) == 0 {
				if repoURL := extractGitHubURL(userPrompt); repoURL != "" {
					s.emit(Event{Type: "message", Message: "Bootstrapping deployment planning because the model did not call tools."})
					if err := s.bootstrapInitialPlan(ctx, repoURL); err != nil {
						s.State = StateFailed
						s.emit(Event{Type: "error", Message: err.Error()})
						return err
					}
					consecutiveNoToolTurns = 0
					messages = append(messages, anthropicMessage{Role: "user", Content: "Planning is confirmed. Continue deployment by calling tools only."})
					continue
				}
			}

			break
		}
		consecutiveNoToolTurns = 0

		// Process tool use blocks
		var toolResults []contentBlock
		for _, block := range resp.Content {
			if block.Type != "tool_use" {
				continue
			}

			log.Printf("[session %s] executing tool: %s", s.ID, block.Name)
			result, toolErr := s.executeTool(ctx, block.Name, block.Input)
			log.Printf("[session %s] tool %s done (err=%v)", s.ID, block.Name, toolErr)

			action := Action{
				Index:     len(s.Actions),
				Tool:      block.Name,
				Input:     block.Input,
				Timestamp: time.Now().UTC(),
			}
			if toolErr != nil {
				action.Error = toolErr.Error()
			} else {
				action.Result = result
			}
			action.Hash = hashAction(action)
			s.Actions = append(s.Actions, action)
			s.emit(Event{Type: "action", Action: &action})

			var resultContent string
			if toolErr != nil {
				resultContent = fmt.Sprintf("error: %s", toolErr.Error())
			} else {
				b, _ := json.Marshal(result)
				resultContent = string(b)
			}

			toolResults = append(toolResults, contentBlock{
				Type:      "tool_result",
				ToolUseID: block.ID,
				Content:   resultContent,
			})
		}

		// Append assistant turn + tool results
		messages = append(messages,
			anthropicMessage{Role: "assistant", Content: assistantBlocks},
			anthropicMessage{Role: "user", Content: toolResults},
		)
	}

	s.State = StateCompleted
	doneEvent := Event{Type: "done", Message: "Deployment complete."}
	if s.lastContainerID != "" {
		doneEvent.ContainerID = s.lastContainerID
		if s.deployDomain != "" {
			doneEvent.DeployedURL = fmt.Sprintf("https://%s.%s", s.lastContainerID, s.deployDomain)
		}
	}
	s.emit(doneEvent)
	return nil
}

// executeTool dispatches a named tool call to the container manager or scanner.
func (s *Session) executeTool(ctx context.Context, name string, input map[string]any) (any, error) {
	switch name {
	case "select_provider":
		s.emit(Event{Type: "message", Message: "Querying ProviderRegistry on Base Sepolia..."})
		provider, err := chain.SelectProvider(ctx, s.rpcURL, s.registryAddress)
		if err != nil {
			// Fall back gracefully so the demo doesn't break if chain is unreachable
			s.emit(Event{Type: "message", Message: fmt.Sprintf("Warning: could not query on-chain providers (%v). Using local node.", err)})
			return map[string]any{
				"endpoint":       "http://localhost:8081",
				"price_per_hour": "0",
				"jobs_completed": 0,
				"source":         "fallback",
			}, nil
		}
		s.SelectedProvider = provider
		return map[string]any{
			"wallet":         provider.Wallet.Hex(),
			"endpoint":       provider.Endpoint,
			"price_per_hour": provider.PricePerHour.String(),
			"jobs_completed": provider.JobsCompleted.Uint64(),
			"source":         "on-chain",
		}, nil

	case "analyze_repo":
		url := sanitizeGitHubURL(stringField(input, "github_url"))
		if url == "" {
			return nil, fmt.Errorf("github_url is required")
		}
		s.emit(Event{Type: "message", Message: fmt.Sprintf("Scanning repository: %s", url)})
		plan, err := s.scanner.AnalyzeRepo(ctx, url, s.githubToken)
		if err != nil {
			return nil, err
		}
		s.Plan = plan
		return plan, nil

	case "generate_deployment_plan":
		plan := map[string]any{
			"summary":                 stringField(input, "summary"),
			"estimated_cost_per_hour": float64Field(input, "estimated_cost_per_hour", 0),
			"containers":              input["containers"],
			"has_smart_contracts":     input["has_smart_contracts"],
			"status":                  "awaiting_confirmation",
		}
		s.emit(Event{Type: "plan", Plan: plan})

		// Block until the user calls POST /sessions/:id/confirm or context is cancelled.
		// Timeout after 10 minutes so abandoned sessions don't hang forever.
		timer := time.NewTimer(10 * time.Minute)
		defer timer.Stop()
		select {
		case <-s.confirmCh:
			plan["status"] = "confirmed"
			s.emit(Event{Type: "message", Message: "Plan confirmed — starting deployment..."})
		case <-timer.C:
			return nil, fmt.Errorf("deployment plan timed out waiting for user confirmation")
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		return plan, nil

	case "create_container":
		opts := container.CreateOpts{
			TeamID:   s.TeamID,
			Name:     stringField(input, "name"),
			Image:    stringField(input, "image"),
			RAMMb:    int64Field(input, "ram_mb", 2048),
			CPUCores: float64Field(input, "cpu_cores", 1.0),
		}
		if ports, ok := input["ports"].([]any); ok {
			for _, p := range ports {
				if ps, ok := p.(string); ok {
					opts.Ports = append(opts.Ports, ps)
				}
			}
		}
		info, err := s.mgr.CreateContainer(ctx, opts)
		if err == nil && info != nil {
			s.mgr.RegisterDeploy(info.ID, info.Ports)
			s.lastContainerID = info.ID
		}
		return info, err

	case "install_packages":
		id := stringField(input, "container_id")
		mgr := container.PackageManager(stringField(input, "manager"))
		var pkgs []string
		if raw, ok := input["packages"].([]any); ok {
			for _, p := range raw {
				if ps, ok := p.(string); ok {
					pkgs = append(pkgs, ps)
				}
			}
		}
		return nil, s.mgr.InstallPackages(ctx, id, pkgs, mgr)

	case "configure_network":
		var ids []string
		if raw, ok := input["container_ids"].([]any); ok {
			for _, p := range raw {
				if ps, ok := p.(string); ok {
					ids = append(ids, ps)
				}
			}
		}
		if err := s.mgr.CreateNetwork(ctx, s.TeamID); err != nil {
			return nil, err
		}
		return nil, s.mgr.ConnectContainers(ctx, s.TeamID, ids)

	case "setup_ide":
		id := stringField(input, "container_id")
		ideType := container.IDEType(stringField(input, "type"))
		return nil, s.mgr.SetupIDE(ctx, id, ideType)

	case "setup_database":
		dbType := container.DBType(stringField(input, "type"))
		version := stringField(input, "version")
		return s.mgr.SetupDatabase(ctx, s.TeamID, dbType, version)

	case "health_check":
		id := stringField(input, "container_id")
		return s.mgr.HealthCheck(ctx, id)

	case "get_logs":
		id := stringField(input, "container_id")
		lines := int(int64Field(input, "lines", 50))
		logs, err := s.mgr.GetLogs(ctx, id, lines)
		return map[string]string{"logs": logs}, err

	case "destroy_container":
		id := stringField(input, "container_id")
		return nil, s.mgr.Destroy(ctx, id)

	case "clone_repo":
		id := stringField(input, "container_id")
		url := sanitizeGitHubURL(stringField(input, "github_url"))
		dir := stringField(input, "directory")
		if url == "" {
			return nil, fmt.Errorf("github_url is required")
		}
		// Inject GitHub token for private repos
		cloneURL := url
		if s.githubToken != "" && strings.Contains(url, "github.com") {
			cloneURL = strings.Replace(url, "https://github.com/",
				fmt.Sprintf("https://x-access-token:%s@github.com/", s.githubToken), 1)
		}
		s.emit(Event{Type: "message", Message: fmt.Sprintf("Cloning %s into container %s ...", url, id)})
		out, err := s.mgr.CloneRepo(ctx, id, cloneURL, dir)
		return map[string]string{"output": out}, err

	case "run_command":
		id := stringField(input, "container_id")
		cmd := stringField(input, "command")
		workDir := stringField(input, "work_dir")
		if workDir == "" {
			workDir = "/app"
		}
		env := mapField(input, "env")
		s.emit(Event{Type: "message", Message: fmt.Sprintf("Running: %s", cmd)})
		out, err := s.mgr.RunCommand(ctx, id, cmd, workDir, env)
		return map[string]string{"output": out}, err

	case "start_process":
		id := stringField(input, "container_id")
		cmd := stringField(input, "command")
		workDir := stringField(input, "work_dir")
		if workDir == "" {
			workDir = "/app"
		}
		env := mapField(input, "env")
		s.emit(Event{Type: "message", Message: fmt.Sprintf("Starting process: %s", cmd)})
		out, err := s.mgr.StartProcess(ctx, id, cmd, workDir, env)
		return map[string]string{"output": out}, err

	case "write_file":
		id := stringField(input, "container_id")
		path := stringField(input, "path")
		content := stringField(input, "content")
		s.emit(Event{Type: "message", Message: fmt.Sprintf("Writing %s", path)})
		return map[string]string{"path": path}, s.mgr.WriteFile(ctx, id, path, content)

	default:
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
}

func (s *Session) callClaude(ctx context.Context, messages []anthropicMessage) (*anthropicResponse, error) {
	oaiMessages := convertMessagesToOpenAI(messages)
	oaiTools := convertToolsToOpenAI(toolDefinitions)

	req := map[string]any{
		"model":       s.model,
		"messages":    oaiMessages,
		"tools":       oaiTools,
		"tool_choice": "auto",
		"stream":      false,
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	endpoint := strings.TrimRight(s.ollamaURL, "/") + "/v1/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama request: %w", err)
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, err
	}
	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama error %d: %s", httpResp.StatusCode, string(respBody))
	}

	var oaiResp openAIChatResponse
	if err := json.Unmarshal(respBody, &oaiResp); err != nil {
		return nil, fmt.Errorf("parse ollama response: %w", err)
	}
	if len(oaiResp.Choices) == 0 {
		return nil, fmt.Errorf("empty ollama response")
	}

	msg := oaiResp.Choices[0].Message
	blocks := make([]contentBlock, 0, 1+len(msg.ToolCalls))
	if strings.TrimSpace(msg.Content) != "" {
		blocks = append(blocks, contentBlock{Type: "text", Text: msg.Content})
	}
	for _, tc := range msg.ToolCalls {
		input := map[string]any{}
		if strings.TrimSpace(tc.Function.Arguments) != "" {
			if err := json.Unmarshal([]byte(tc.Function.Arguments), &input); err != nil {
				input = map[string]any{"_raw": tc.Function.Arguments}
			}
		}
		blocks = append(blocks, contentBlock{
			Type:  "tool_use",
			ID:    tc.ID,
			Name:  tc.Function.Name,
			Input: input,
		})
	}

	stop := oaiResp.Choices[0].FinishReason
	if stop == "tool_calls" {
		stop = "tool_use"
	}

	return &anthropicResponse{
		ID:         oaiResp.ID,
		Type:       "message",
		Model:      oaiResp.Model,
		Content:    blocks,
		StopReason: stop,
	}, nil
}

type openAIChatResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Role      string `json:"role"`
			Content   string `json:"content"`
			ToolCalls []struct {
				ID       string `json:"id"`
				Type     string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"message"`
	} `json:"choices"`
}

func convertToolsToOpenAI(defs []map[string]any) []map[string]any {
	tools := make([]map[string]any, 0, len(defs))
	for _, d := range defs {
		name, _ := d["name"].(string)
		desc, _ := d["description"].(string)
		params, _ := d["input_schema"].(map[string]any)
		tools = append(tools, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        name,
				"description": desc,
				"parameters":  params,
			},
		})
	}
	return tools
}

func convertMessagesToOpenAI(messages []anthropicMessage) []map[string]any {
	out := make([]map[string]any, 0, len(messages)+2)
	out = append(out, map[string]any{"role": "system", "content": systemPrompt})

	for _, m := range messages {
		switch c := m.Content.(type) {
		case string:
			out = append(out, map[string]any{"role": m.Role, "content": c})
		case []contentBlock:
			if m.Role == "assistant" {
				msg := map[string]any{"role": "assistant", "content": ""}
				var texts []string
				var toolCalls []map[string]any
				for _, b := range c {
					if b.Type == "text" && b.Text != "" {
						texts = append(texts, b.Text)
					}
					if b.Type == "tool_use" {
						args, _ := json.Marshal(b.Input)
						toolCalls = append(toolCalls, map[string]any{
							"id":   b.ID,
							"type": "function",
							"function": map[string]any{
								"name":      b.Name,
								"arguments": string(args),
							},
						})
					}
				}
				if len(texts) > 0 {
					msg["content"] = strings.Join(texts, "\n")
				}
				if len(toolCalls) > 0 {
					msg["tool_calls"] = toolCalls
				}
				out = append(out, msg)
			} else if m.Role == "user" {
				for _, b := range c {
					if b.Type == "tool_result" {
						out = append(out, map[string]any{
							"role":         "tool",
							"tool_call_id": b.ToolUseID,
							"content":      b.Content,
						})
					}
				}
			}
		default:
			out = append(out, map[string]any{"role": m.Role, "content": fmt.Sprint(m.Content)})
		}
	}

	return out
}

func (s *Session) emit(e Event) {
	select {
	case s.events <- e:
	default:
		// drop if buffer full
	}
}

func (s *Session) bootstrapInitialPlan(ctx context.Context, repoURL string) error {
	analyzeResult, err := s.executeToolAndRecord(ctx, "analyze_repo", map[string]any{"github_url": repoURL})
	if err != nil {
		return err
	}

	_, _ = s.executeToolAndRecord(ctx, "select_provider", map[string]any{})

	plan, ok := analyzeResult.(*scanner.DeploymentPlan)
	if !ok || plan == nil {
		return fmt.Errorf("bootstrap analyze_repo returned invalid plan")
	}

	_, err = s.executeToolAndRecord(ctx, "generate_deployment_plan", map[string]any{
		"summary":                 plan.Summary,
		"estimated_cost_per_hour": plan.EstimatedCostPerHour,
		"containers":              plan.Containers,
		"has_smart_contracts":     plan.HasSmartContracts,
	})
	return err
}

func (s *Session) executeToolAndRecord(ctx context.Context, name string, input map[string]any) (any, error) {
	result, toolErr := s.executeTool(ctx, name, input)

	action := Action{
		Index:     len(s.Actions),
		Tool:      name,
		Input:     input,
		Timestamp: time.Now().UTC(),
	}
	if toolErr != nil {
		action.Error = toolErr.Error()
	} else {
		action.Result = result
	}
	action.Hash = hashAction(action)
	s.Actions = append(s.Actions, action)
	s.emit(Event{Type: "action", Action: &action})

	return result, toolErr
}

func extractGitHubURL(input string) string {
	re := regexp.MustCompile(`https://github\.com/[\w\-.]+/[\w\-.]+`)
	match := re.FindString(input)
	return sanitizeGitHubURL(match)
}

func sanitizeGitHubURL(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.Trim(s, "\"'`")
	s = strings.TrimRight(s, ".,;:!?)]}>")
	s = strings.TrimSuffix(s, "/")
	s = strings.TrimSuffix(s, ".git")
	return s
}

// hashAction computes a deterministic SHA-256 hash of the action for the audit log.
func hashAction(a Action) string {
	b, _ := json.Marshal(map[string]any{
		"index": a.Index,
		"tool":  a.Tool,
		"input": a.Input,
	})
	return fmt.Sprintf("sha256:%x", sha256.Sum256(b))
}

// --- input helpers ---

func stringField(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func int64Field(m map[string]any, key string, def int64) int64 {
	switch v := m[key].(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	}
	return def
}

func float64Field(m map[string]any, key string, def float64) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return def
}

// mapField extracts a map[string]string from a JSON-decoded map[string]any.
func mapField(m map[string]any, key string) map[string]string {
	out := make(map[string]string)
	raw, ok := m[key].(map[string]any)
	if !ok {
		return out
	}
	for k, v := range raw {
		if s, ok := v.(string); ok {
			out[k] = s
		}
	}
	return out
}
