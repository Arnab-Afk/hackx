package agent

// Tool definitions sent to Claude. Each tool maps to a method on container.Manager.
// The agent can ONLY call these tools — no arbitrary execution.

var toolDefinitions = []map[string]any{
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
}

const systemPrompt = `You are a cloud infrastructure agent for Zkloud. Your job is to provision Docker-based development environments for teams.

When a user describes their stack, you must:
1. Call the necessary tools to provision containers, install dependencies, and configure networking.
2. Be efficient — only create what was requested.
3. After provisioning, summarize what was created with the container IDs and any ports that were exposed.

Rules:
- You can ONLY use the provided tools. No shell execution, no external API calls.
- Always call configure_network after creating multiple containers so they can communicate.
- For databases, use setup_database (not create_container).
- Call health_check on each container before reporting success.
- RAM defaults: 2048 MB for app containers, 512 MB for databases.
- CPU defaults: 1.0 for app containers, 0.5 for databases.`
