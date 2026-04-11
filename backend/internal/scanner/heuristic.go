package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/go-git/go-git/v5"
)

// DeployOption is one deployable component detected in the repo.
type DeployOption struct {
	Type       string `json:"type"`        // "frontend" | "backend"
	Framework  string `json:"framework"`   // "nextjs", "react", "express", "fastapi", "go", ...
	Language   string `json:"language"`    // "node", "python", "go", "static"
	SubDir     string `json:"sub_dir"`     // relative path from repo root, empty means root
	InstallCmd string `json:"install_cmd"` // e.g. "npm install"
	BuildCmd   string `json:"build_cmd"`   // e.g. "npm run build" (empty if none)
	StartCmd   string `json:"start_cmd"`   // e.g. "npm start"
	Port       int    `json:"port"`        // default port the app listens on
}

// RepoScan is the result of a heuristic scan — no AI required.
type RepoScan struct {
	RepoURL string         `json:"repo_url"`
	Options []DeployOption `json:"options"` // let user pick one
	EnvVars []string       `json:"env_vars"` // keys from .env.example
}

// ScanRepo clones the repo (shallow) and returns detected deploy options.
// token is an optional GitHub OAuth/PAT token for private repos.
func ScanRepo(ctx context.Context, repoURL string, token ...string) (*RepoScan, error) {
	dir, err := os.MkdirTemp("", "zkloud-heuristic-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	cloneURL := extractRepoRoot(repoURL)
	if len(token) > 0 && token[0] != "" {
		cloneURL = injectToken(cloneURL, token[0])
	}

	_, err = git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:   cloneURL,
		Depth: 1,
	})
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "authentication required") || strings.Contains(errMsg, "Repository not found") {
			return nil, fmt.Errorf("private repo or not found — connect GitHub via /auth/github?wallet=<your_wallet> first")
		}
		return nil, err
	}

	scan := &RepoScan{RepoURL: repoURL}
	scan.Options = detectOptions(dir)
	if scan.Options == nil {
		scan.Options = []DeployOption{} // never return null
	}
	scan.EnvVars = detectEnvVars(dir)
	if scan.EnvVars == nil {
		scan.EnvVars = []string{}
	}
	return scan, nil
}

// detectOptions inspects the repo root and one level of subdirectories,
// returning all deployable components found anywhere in the repo.
func detectOptions(root string) []DeployOption {
	var opts []DeployOption

	// Check root first
	opts = append(opts, detectOptionsInDir(root, "")...)

	// Check immediate subdirectories (monorepo support)
	entries, err := os.ReadDir(root)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") || e.Name() == "node_modules" {
				continue
			}
			sub := e.Name()
			subOpts := detectOptionsInDir(root, sub)
			opts = append(opts, subOpts...)
		}
	}

	return opts
}

// detectOptionsInDir inspects a single directory (root/subdir) for deployable components.
// subdir is a relative path from root (empty string means root itself).
func detectOptionsInDir(root, subdir string) []DeployOption {
	var opts []DeployOption
	dir := root
	if subdir != "" {
		dir = root + "/" + subdir
	}

	// ── Node.js ───────────────────────────────────────────────────────────────
	if pkg := readJSON(dir + "/package.json"); pkg != nil {
		deps := mergeDeps(pkg)
		scripts, _ := pkg["scripts"].(map[string]any)

		buildCmd := scriptCmd(scripts, "build")
		startCmd := scriptCmd(scripts, "start")
		if startCmd == "" {
			startCmd = scriptCmd(scripts, "dev")
		}

		switch {
		case hasDep(deps, "next"):
			if startCmd == "" {
				startCmd = "npm start"
			}
			opts = append(opts, DeployOption{
				Type: "frontend", Framework: "nextjs", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd, StartCmd: startCmd, Port: 3000,
			})
		case hasDep(deps, "@sveltejs/kit"), hasDep(deps, "svelte"):
			if startCmd == "" {
				startCmd = "node build"
			}
			opts = append(opts, DeployOption{
				Type: "frontend", Framework: "sveltekit", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd, StartCmd: startCmd, Port: 3000,
			})
		case hasDep(deps, "nuxt"):
			if startCmd == "" {
				startCmd = "node .output/server/index.mjs"
			}
			opts = append(opts, DeployOption{
				Type: "frontend", Framework: "nuxt", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd, StartCmd: startCmd, Port: 3000,
			})
		case hasDep(deps, "react"):
			if buildCmd == "" {
				buildCmd = "npm run build"
			}
			opts = append(opts, DeployOption{
				Type: "frontend", Framework: "react", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd,
				StartCmd: "npx serve -s build -l 3000", Port: 3000,
			})
		case hasDep(deps, "vue"):
			opts = append(opts, DeployOption{
				Type: "frontend", Framework: "vue", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd,
				StartCmd: "npx serve -s dist -l 3000", Port: 3000,
			})
		}

		// Backend node frameworks (can coexist with frontend in a monorepo)
		switch {
		case hasDep(deps, "@nestjs/core"):
			if startCmd == "" {
				startCmd = "node dist/main"
			}
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "nestjs", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", BuildCmd: buildCmd, StartCmd: startCmd, Port: 3000,
			})
		case hasDep(deps, "express"):
			if startCmd == "" {
				startCmd = "node index.js"
			}
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "express", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", StartCmd: startCmd, Port: 3000,
			})
		case hasDep(deps, "fastify"):
			if startCmd == "" {
				startCmd = "node server.js"
			}
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "fastify", Language: "node", SubDir: subdir,
				InstallCmd: "npm install", StartCmd: startCmd, Port: 3000,
			})
		}
	}

	// ── Python ────────────────────────────────────────────────────────────────
	if reqs := readFile(dir + "/requirements.txt"); reqs != "" {
		lower := strings.ToLower(reqs)
		switch {
		case strings.Contains(lower, "fastapi"):
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "fastapi", Language: "python", SubDir: subdir,
				InstallCmd: "pip install -r requirements.txt",
				StartCmd:   "uvicorn main:app --host 0.0.0.0 --port 8000", Port: 8000,
			})
		case strings.Contains(lower, "flask"):
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "flask", Language: "python", SubDir: subdir,
				InstallCmd: "pip install -r requirements.txt",
				StartCmd:   "python app.py", Port: 5000,
			})
		case strings.Contains(lower, "django"):
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "django", Language: "python", SubDir: subdir,
				InstallCmd: "pip install -r requirements.txt",
				StartCmd:   "python manage.py runserver 0.0.0.0:8000", Port: 8000,
			})
		default:
			opts = append(opts, DeployOption{
				Type: "backend", Framework: "python", Language: "python", SubDir: subdir,
				InstallCmd: "pip install -r requirements.txt",
				StartCmd:   "python main.py", Port: 8000,
			})
		}
	}

	// ── Go ────────────────────────────────────────────────────────────────────
	if readFile(dir+"/go.mod") != "" {
		opts = append(opts, DeployOption{
			Type: "backend", Framework: "go", Language: "go", SubDir: subdir,
			InstallCmd: "go mod download",
			BuildCmd:   "go build -o app .",
			StartCmd:   "./app", Port: 8080,
		})
	}

	// ── Static HTML ───────────────────────────────────────────────────────────
	if _, err := os.Stat(dir + "/index.html"); err == nil {
		opts = append(opts, DeployOption{
			Type: "frontend", Framework: "static", Language: "static", SubDir: subdir,
			StartCmd: "npx serve -l 3000 .", Port: 3000,
		})
	}

	return opts
}

func detectEnvVars(root string) []string {
	content := readFile(root + "/.env.example")
	if content == "" {
		content = readFile(root + "/.env.sample")
	}
	if content == "" {
		return nil
	}
	var keys []string
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if idx := strings.Index(line, "="); idx > 0 {
			keys = append(keys, line[:idx])
		}
	}
	return keys
}

// ── helpers ───────────────────────────────────────────────────────────────────

func readJSON(path string) map[string]any {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var m map[string]any
	json.Unmarshal(data, &m)
	return m
}

func readFile(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func mergeDeps(pkg map[string]any) map[string]any {
	merged := map[string]any{}
	for _, key := range []string{"dependencies", "devDependencies", "peerDependencies"} {
		if m, ok := pkg[key].(map[string]any); ok {
			for k, v := range m {
				merged[k] = v
			}
		}
	}
	return merged
}

func hasDep(deps map[string]any, name string) bool {
	_, ok := deps[name]
	return ok
}

func scriptCmd(scripts map[string]any, name string) string {
	if scripts == nil {
		return ""
	}
	v, _ := scripts[name].(string)
	return v
}
