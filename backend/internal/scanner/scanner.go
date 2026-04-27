package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// StackComponent represents a detected technology in the repo.
type StackComponent struct {
	Name    string `json:"name"`    // e.g. "Next.js", "Express", "Solidity"
	Version string `json:"version"` // e.g. "14.x", detected from config files
	Type    string `json:"type"`    // "frontend" | "backend" | "database" | "smart-contract" | "infra"
}

// ContainerSpec is the agent's prescription for a single container.
type ContainerSpec struct {
	Name     string            `json:"name"`
	Image    string            `json:"image"`
	Ports    []string          `json:"ports"`    // e.g. ["3000/tcp"]
	RAMMb    int64             `json:"ram_mb"`
	CPUCores float64           `json:"cpu_cores"`
	EnvVars  map[string]string `json:"env_vars"` // known env vars from .env.example etc.
}

// DeploymentPlan is what the scanner returns after analyzing a repo.
type DeploymentPlan struct {
	RepoURL              string           `json:"repo_url"`
	DetectedStack        []StackComponent `json:"detected_stack"`
	Containers           []ContainerSpec  `json:"containers"`
	HasSmartContracts    bool             `json:"has_smart_contracts"`
	RecommendedNetwork   string           `json:"recommended_network"` // e.g. "base-sepolia"
	EstimatedCostPerHour float64          `json:"estimated_cost_per_hour"`
	Summary              string           `json:"summary"`
	DeploymentSteps      []string         `json:"deployment_steps"`
}

// Scanner analyzes a GitHub repo and returns a deployment plan using Ollama.
type Scanner struct {
	ollamaURL string // e.g. http://localhost:11434
	model     string // e.g. qwen2.5-coder
}

func New(ollamaURL, model string) *Scanner {
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}
	if model == "" {
		model = "qwen2.5-coder"
	}
	return &Scanner{ollamaURL: ollamaURL, model: model}
}

// extractRepoRoot converts a GitHub tree/blob URL to a clonable root URL.
// e.g. https://github.com/user/repo/tree/main/subdir → https://github.com/user/repo
func extractRepoRoot(rawURL string) string {
	rawURL = sanitizeGitHubURL(rawURL)
	// Match https://github.com/<owner>/<repo>(/...)?
	parts := strings.SplitN(rawURL, "/", 6) // ["https:", "", "github.com", owner, repo, rest...]
	if len(parts) >= 5 && strings.Contains(rawURL, "github.com") {
		return strings.Join(parts[:5], "/")
	}
	return rawURL
}

// AnalyzeRepo clones the repo and returns a deployment plan.
// githubToken is optional — provide it for private repos.
func (s *Scanner) AnalyzeRepo(ctx context.Context, repoURL string, githubToken ...string) (*DeploymentPlan, error) {
	repoURL = sanitizeGitHubURL(repoURL)
	dir, err := os.MkdirTemp("", "zkloud-scan-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	cloneURL := extractRepoRoot(repoURL)
	// For private repos: inject token into the URL
	// https://github.com/user/repo → https://x-access-token:<token>@github.com/user/repo
	if len(githubToken) > 0 && githubToken[0] != "" {
		cloneURL = injectToken(cloneURL, githubToken[0])
	}

	cmd := exec.CommandContext(ctx, "git", "clone", "--depth=1", "--quiet", cloneURL, dir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("clone %s: %w\n%s", repoURL, err, string(out))
	}

	// Collect relevant files
	files, err := collectFiles(dir)
	if err != nil {
		return nil, fmt.Errorf("collect files: %w", err)
	}

	// Ask Ollama/Gemma to analyze
	plan, err := s.analyzeWithOllama(ctx, repoURL, files)
	if err != nil {
		return nil, fmt.Errorf("ollama analysis: %w", err)
	}

	return plan, nil
}

// repoFile holds a relative path and its content (truncated if large).
type repoFile struct {
	Path    string
	Content string
}

// collectFiles walks the repo and picks up files relevant for stack detection.
func collectFiles(root string) ([]repoFile, error) {
	// Files we always want if they exist
	priority := []string{
		"package.json", "package-lock.json",
		"requirements.txt", "pyproject.toml", "Pipfile",
		"go.mod", "Cargo.toml",
		"Dockerfile", "docker-compose.yml", "docker-compose.yaml",
		"hardhat.config.js", "hardhat.config.ts",
		"foundry.toml", "forge.toml",
		"next.config.js", "next.config.ts",
		"vite.config.js", "vite.config.ts",
		".env.example", ".env.sample",
		"README.md",
	}

	seen := map[string]bool{}
	var files []repoFile

	// First pass: priority files from root
	for _, name := range priority {
		path := filepath.Join(root, name)
		content, err := readTruncated(path, 4000)
		if err == nil {
			rel := name
			files = append(files, repoFile{Path: rel, Content: content})
			seen[rel] = true
		}
	}

	// Second pass: walk up to 2 levels for nested package.json / contracts
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if d.IsDir() {
			if true {
				name := d.Name()
				// Skip hidden dirs and heavy dirs
				if strings.HasPrefix(name, ".") || name == "node_modules" ||
					name == "dist" || name == "build" || name == ".next" ||
					name == "out" || name == "target" || name == "artifacts" ||
					name == "cache" || name == "lib" {
					return filepath.SkipDir
				}
			}
			return nil
		}

		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)

		if seen[rel] {
			return nil
		}

		// Depth limit: max 3 levels deep
		if strings.Count(rel, "/") > 2 {
			return nil
		}

		base := filepath.Base(path)
		ext := strings.ToLower(filepath.Ext(path))

		// Pick up Solidity files (first 5 only)
		if ext == ".sol" {
			solCount := 0
			for _, f := range files {
				if strings.HasSuffix(f.Path, ".sol") {
					solCount++
				}
			}
			if solCount < 5 {
				content, err := readTruncated(path, 3000)
				if err == nil {
					files = append(files, repoFile{Path: rel, Content: content})
					seen[rel] = true
				}
			}
		}

		// Pick up nested package.json / config files
		if base == "package.json" || base == "hardhat.config.js" ||
			base == "hardhat.config.ts" || base == "foundry.toml" ||
			base == "requirements.txt" || base == "go.mod" {
			content, err := readTruncated(path, 3000)
			if err == nil {
				files = append(files, repoFile{Path: rel, Content: content})
				seen[rel] = true
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return files, nil
}

// injectToken rewrites a GitHub HTTPS URL to embed an access token.
// https://github.com/user/repo → https://x-access-token:<token>@github.com/user/repo
func injectToken(repoURL, token string) string {
	return strings.Replace(repoURL, "https://github.com/", fmt.Sprintf("https://x-access-token:%s@github.com/", token), 1)
}

func sanitizeGitHubURL(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.Trim(s, "\"'`")
	s = strings.TrimRight(s, ".,;:!?)]}>")
	s = strings.TrimSuffix(s, "/")
	s = strings.TrimSuffix(s, ".git")
	return s
}

func readTruncated(path string, maxBytes int) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	buf := make([]byte, maxBytes)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return "", err
	}
	content := string(buf[:n])
	if n == maxBytes {
		content += "\n... (truncated)"
	}
	return content, nil
}

// analyzeWithOllama sends collected files to Ollama and parses the plan.
func (s *Scanner) analyzeWithOllama(ctx context.Context, repoURL string, files []repoFile) (*DeploymentPlan, error) {
	// Build the file context
	var sb strings.Builder
	for _, f := range files {
		sb.WriteString(fmt.Sprintf("\n\n### FILE: %s\n```\n%s\n```", f.Path, f.Content))
	}

	prompt := fmt.Sprintf(`You are a deployment analyzer for zkLOUD, a decentralized compute platform.

Analyze the following repository files and return a JSON deployment plan.

Repository URL: %s

Files:
%s

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "repo_url": "string",
  "detected_stack": [
    { "name": "string", "version": "string", "type": "frontend|backend|database|smart-contract|infra" }
  ],
  "containers": [
    {
      "name": "string",
      "image": "string (official Docker image tag)",
      "ports": ["3000/tcp"],
      "ram_mb": 2048,
      "cpu_cores": 1.0,
      "env_vars": { "KEY": "value or empty string" }
    }
  ],
  "has_smart_contracts": true,
  "recommended_network": "base-sepolia or mainnet or none",
  "estimated_cost_per_hour": 0.05,
  "summary": "one sentence describing the stack",
  "deployment_steps": ["step1", "step2"]
}

Rules:
- Use official minimal Docker images (node:20-alpine, python:3.12-slim, etc.)
- Databases should be separate containers (postgres:16-alpine, mongo:7, redis:7-alpine)
- For Next.js use node:20-alpine, expose 3000/tcp
- For Hardhat/Foundry projects set has_smart_contracts=true
- RAM: 512MB databases, 1024-2048MB app containers
- estimated_cost_per_hour: $0.02-0.10 based on total resource usage
	- deployment_steps: ordered list of what the agent will do`, repoURL, sb.String())

	reqBody := map[string]any{
		"model":  s.model,
		"prompt": prompt,
		"stream": false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := strings.TrimRight(s.ollamaURL, "/") + "/api/generate"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama error %d: %s", resp.StatusCode, string(respBody))
	}

	var ollamaResp struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(respBody, &ollamaResp); err != nil {
		return nil, fmt.Errorf("parse response: %w\nraw: %s", err, string(respBody[:min(len(respBody), 500)]))
	}
	if strings.TrimSpace(ollamaResp.Response) == "" {
		return nil, fmt.Errorf("empty response from model\nraw: %s", string(respBody[:min(len(respBody), 500)]))
	}

	rawJSON := strings.TrimSpace(ollamaResp.Response)

	// Strip markdown fences if the model added them anyway
	rawJSON = strings.TrimSpace(rawJSON)
	if strings.HasPrefix(rawJSON, "```") {
		lines := strings.Split(rawJSON, "\n")
		// remove first and last lines
		if len(lines) > 2 {
			rawJSON = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}

	var plan DeploymentPlan
	if err := json.Unmarshal([]byte(rawJSON), &plan); err != nil {
		return nil, fmt.Errorf("parse deployment plan JSON: %w\nraw: %s", err, rawJSON)
	}

	plan.RepoURL = repoURL
	return &plan, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
