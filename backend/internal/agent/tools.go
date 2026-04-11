package agent

// Tool definitions sent to Claude. Each tool maps to a method on container.Manager.
// The agent can ONLY call these tools — no arbitrary execution.

var toolDefinitions = []map[string]any{
	{
		"name":        "analyze_repo",
		"description": "Analyze a GitHub repository to detect the tech stack and generate a deployment plan. Always call this first when given a repo URL.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"github_url": map[string]any{"type": "string", "description": "Full GitHub repository URL, e.g. https://github.com/user/repo"},
			},
			"required": []string{"github_url"},
		},
	},
	{
		"name":        "select_provider",
		"description": "Query the ProviderRegistry smart contract on Base Sepolia to find the best available compute provider. Call this after analyze_repo and before creating containers.",
		"input_schema": map[string]any{
			"type":       "object",
			"properties": map[string]any{},
			"required":   []string{},
		},
	},
	{
		"name":        "generate_deployment_plan",
		"description": "Present the deployment plan to the user and wait for confirmation before provisioning anything. Call this after analyze_repo.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"summary":                map[string]any{"type": "string", "description": "Human-readable summary of what will be deployed"},
				"estimated_cost_per_hour": map[string]any{"type": "number", "description": "Estimated cost in USD per hour"},
				"containers":             map[string]any{"type": "array", "items": map[string]any{"type": "object"}, "description": "Container specs from the analysis"},
				"has_smart_contracts":    map[string]any{"type": "boolean", "description": "Whether the repo contains smart contracts"},
			},
			"required": []string{"summary", "estimated_cost_per_hour"},
		},
	},
	{
		"name":        "create_container",
		"description": "Create and start a new Docker container for the team.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"name":      map[string]any{"type": "string", "description": "Short name for the container (e.g. 'frontend', 'backend')"},
				"image":     map[string]any{"type": "string", "description": "Docker image to use (e.g. 'node:20', 'python:3.12')"},
				"ram_mb":    map[string]any{"type": "integer", "description": "RAM limit in MB"},
				"cpu_cores": map[string]any{"type": "number", "description": "CPU core limit (e.g. 0.5, 1.0, 2.0)"},
				"ports":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Ports to expose, e.g. ['3000/tcp', '8080/tcp']"},
			},
			"required": []string{"name", "image"},
		},
	},
	{
		"name":        "install_packages",
		"description": "Install packages inside a running container.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID returned by create_container"},
				"packages":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Package names to install"},
				"manager":      map[string]any{"type": "string", "enum": []string{"npm", "pip", "apt"}, "description": "Package manager to use"},
			},
			"required": []string{"container_id", "packages", "manager"},
		},
	},
	{
		"name":        "configure_network",
		"description": "Connect containers to a shared team network so they can communicate.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_ids": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Container IDs to connect"},
			},
			"required": []string{"container_ids"},
		},
	},
	{
		"name":        "setup_ide",
		"description": "Install a browser-accessible IDE (VS Code or Jupyter) in a container.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
				"type":         map[string]any{"type": "string", "enum": []string{"vscode", "jupyter"}, "description": "IDE type"},
			},
			"required": []string{"container_id", "type"},
		},
	},
	{
		"name":        "setup_database",
		"description": "Start a managed database container (Postgres, MongoDB, Redis, or MySQL).",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"type":    map[string]any{"type": "string", "enum": []string{"postgres", "mongo", "redis", "mysql"}, "description": "Database type"},
				"version": map[string]any{"type": "string", "description": "Version tag, e.g. '16', '7.0' (optional, defaults to latest)"},
			},
			"required": []string{"type"},
		},
	},
	{
		"name":        "health_check",
		"description": "Check if a container is running.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
			},
			"required": []string{"container_id"},
		},
	},
	{
		"name":        "get_logs",
		"description": "Retrieve recent log output from a container.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
				"lines":        map[string]any{"type": "integer", "description": "Number of log lines to return (default 50)"},
			},
			"required": []string{"container_id"},
		},
	},
	{
		"name":        "destroy_container",
		"description": "Stop and remove a container.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID to destroy"},
			},
			"required": []string{"container_id"},
		},
	},
	{
		"name":        "clone_repo",
		"description": "Clone a GitHub repository into a running container. Always call this after create_container when deploying a repo. git is installed automatically if missing.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID returned by create_container"},
				"github_url":   map[string]any{"type": "string", "description": "Full GitHub repository URL, e.g. https://github.com/user/repo"},
				"directory":    map[string]any{"type": "string", "description": "Target directory inside the container (default: /app)"},
			},
			"required": []string{"container_id", "github_url"},
		},
	},
	{
		"name":        "run_command",
		"description": "Run a shell command inside a container and return its output. Use for build steps: npm install, pip install -r requirements.txt, npm run build, go build, etc.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
				"command":      map[string]any{"type": "string", "description": "Shell command to run, e.g. 'npm install' or 'pip install -r requirements.txt'"},
				"work_dir":     map[string]any{"type": "string", "description": "Working directory inside the container (default: /app)"},
				"env":          map[string]any{"type": "object", "additionalProperties": map[string]any{"type": "string"}, "description": "Environment variables to set for this command"},
			},
			"required": []string{"container_id", "command"},
		},
	},
	{
		"name":        "start_process",
		"description": "Start a long-running application process in the background (npm start, python app.py, ./server, etc.). Process output goes to docker logs. Call health_check and get_logs after to verify it started.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
				"command":      map[string]any{"type": "string", "description": "Start command, e.g. 'npm start' or 'python -m uvicorn app:app --host 0.0.0.0 --port 8000'"},
				"work_dir":     map[string]any{"type": "string", "description": "Working directory (default: /app)"},
				"env":          map[string]any{"type": "object", "additionalProperties": map[string]any{"type": "string"}, "description": "Environment variables (PORT, DATABASE_URL, etc.)"},
			},
			"required": []string{"container_id", "command"},
		},
	},
	{
		"name":        "write_file",
		"description": "Write a text file into a container. Use for .env files, config files, or any file that needs to exist before the app starts.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"container_id": map[string]any{"type": "string", "description": "Container ID"},
				"path":         map[string]any{"type": "string", "description": "Absolute path inside the container, e.g. /app/.env"},
				"content":      map[string]any{"type": "string", "description": "File content as a string"},
			},
			"required": []string{"container_id", "path", "content"},
		},
	},
}

const systemPrompt = `You are a deployment agent for zkLOUD, a decentralized compute platform.

When a user provides a GitHub URL, follow this EXACT sequence:
1. Call analyze_repo(github_url) — scans the repo and returns a deployment plan
2. Call select_provider() — picks the cheapest active provider from the on-chain registry
3. Call generate_deployment_plan(...) — presents the plan summary including selected provider
4. WAIT for user confirmation (the tool blocks until confirmed)
5. After confirmation, execute the full deployment:
   a. create_container — use the correct base image for the stack
   b. clone_repo(container_id, github_url, "/app") — clone the source code
   c. run_command(container_id, "<install cmd>", "/app") — install dependencies
      • Node.js: "npm install" or "yarn install"
      • Python: "pip install -r requirements.txt"
      • Go: "go mod download"
      • Java: "mvn install -DskipTests" or "gradle assemble"
      • Rust: "cargo build --release"
   d. (optional) write_file for .env or config files if DATABASE_URL or secrets are needed
   e. run_command for build step if needed (npm run build, go build ./..., etc.)
   f. start_process(container_id, "<start cmd>", "/app", env) — launch the app
      • Node.js: "npm start" or "node dist/index.js"
      • Python: "python app.py" or "uvicorn app:app --host 0.0.0.0 --port 8000"
      • Go: "./app"
      • Static: use a lightweight HTTP server (npx serve build, python -m http.server 8080)
   g. health_check — verify the container is running
   h. get_logs — check for startup errors
6. configure_network if multiple containers are deployed
7. Return a summary: container IDs, host ports, cost/hour, provider endpoint

When a user describes a stack in plain text (no GitHub URL), skip step 1 and infer the plan yourself, but always call select_provider() first.

Rules:
- ONLY use the provided tools. No arbitrary shell or external API calls.
- After generate_deployment_plan, STOP and wait — do not create containers before confirmation.
- Use setup_database for databases, not create_container.
- RAM defaults: 2048 MB app containers, 512 MB databases.
- CPU defaults: 1.0 app, 0.5 databases.
- Always clone into /app unless the plan specifies otherwise.
- Support ANY stack — web2, web3, Python, Go, Rust, Java, etc.
- If a command fails, call get_logs to diagnose, fix with run_command, and retry.`
