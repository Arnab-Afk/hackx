# Backend API Reference

Base URL: `https://backendapi.comput3.xyz`

---

## Deployment Flow

```
                        ┌─────────────┐
                        │  POST /teams │
                        └──────┬──────┘
                               │ team_id
                               ▼
                     ┌──────────────────┐
                     │  POST /sessions  │
                     │  (repo_url +     │
                     │   prompt)        │
                     └────────┬─────────┘
                              │ sess_id
                              ▼
                   ┌─────────────────────┐
                   │  Agent: analyze_repo │  ← clones repo, scans stack
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌──────────────────────────┐
                   │  Agent: generate_plan     │  ← BLOCKS here waiting for
                   │  (awaiting_confirmation)  │    POST /sessions/:id/confirm
                   └──────────┬───────────────┘
                              │ confirmed
                              ▼
                   ┌──────────────────────┐
                   │  Agent: create_       │  ← pulls Docker image,
                   │  container           │    creates container
                   └──────────┬───────────┘
                              │ container_id registered in deploy registry
                              ▼
                   ┌──────────────────────┐
                   │  Agent: clone_repo   │  ← git clone inside container
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Agent: run_command  │  ← npm install / pip install
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Agent: start_process│  ← nohup node index.js &
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Agent: health_check │  ← waits for HTTP 200
                   └──────────┬───────────┘
                              │ session state → "completed"
                              ▼
              ┌──────────────────────────────────┐
              │  App live at:                     │
              │  {containerID}.deploy.comput3.xyz │
              └──────────────────────────────────┘
```

---

## Endpoints

### Teams

**Create a team**
```
POST /teams
Content-Type: application/json

{
  "name":       "my-team",
  "public_key": "0x..."     // optional
}
```
```json
{
  "id":         "team-1775967090642227861",
  "name":       "my-team",
  "wallet":     "",
  "public_key": "0x...",
  "created_at": "2026-04-12T04:11:30Z"
}
```

**Get a team**
```
GET /teams/:teamID
```

**List team containers**
```
GET /teams/:teamID/containers
```
```json
[
  {
    "ID":     "f1a4afd49d80",
    "Name":   "web",
    "Status": "running",
    "Ports":  { "3000/tcp": "32772" }
  }
]
```

---

### Sessions (AI Deployment)

**Create a session**
```
POST /sessions
Content-Type: application/json

{
  "team_id":      "team-xxx",
  "prompt":       "Deploy the repo on port 3000.",
  "repo_url":     "https://github.com/owner/repo",  // optional
  "github_token": "ghp_..."                          // optional — private repos
}
```
```json
{
  "id":         "sess-1775967795263056079",
  "team_id":    "team-xxx",
  "prompt":     "...",
  "state":      "running",
  "created_at": "2026-04-12T04:23:15Z",
  "updated_at": "2026-04-12T04:23:15Z"
}
```
> If `repo_url` is supplied, the agent automatically calls `analyze_repo` first.  
> If omitted, describe the app in `prompt` and the agent creates it from scratch.

**Get session state**
```
GET /sessions/:sessionID
```
```json
{
  "id":    "sess-xxx",
  "state": "running | completed | failed"
}
```

**Confirm deployment plan**
```
POST /sessions/:sessionID/confirm
Content-Type: application/json

{ "approved": true }
```
```json
{ "session_id": "sess-xxx", "status": "confirmed" }
```
> The agent pauses at `generate_deployment_plan` and waits up to 10 minutes.  
> Call this endpoint to unblock it. Safe to call immediately after session creation — it queues and fires when the plan is ready.

**Get action log** *(available after session completes)*
```
GET /sessions/:sessionID/log
```
```json
{
  "session_id": "sess-xxx",
  "team_id":    "team-xxx",
  "actions":    [ ... ],
  "created_at": "..."
}
```

**Stream live events** *(WebSocket)*
```
GET /sessions/:sessionID/stream
Upgrade: websocket
```
Event types emitted over the socket:

| type      | description                            |
|-----------|----------------------------------------|
| `plan`    | Deployment plan ready, waiting confirm |
| `message` | Agent status update                    |
| `action`  | Tool call result (create, clone, etc.) |
| `done`    | Session completed successfully         |
| `error`   | Session failed with reason             |

---

### Containers

**Delete / stop a container**
```
DELETE /containers/:containerID
```

---

### Repo Scanning

**Scan a repo without deploying**
```
POST /repos/scan
Content-Type: application/json

{ "repo_url": "https://github.com/owner/repo" }
```
```json
{
  "repo_url": "https://github.com/owner/repo",
  "options": [
    {
      "type":        "backend",
      "framework":   "express",
      "language":    "node",
      "sub_dir":     "",
      "install_cmd": "npm install",
      "build_cmd":   "",
      "start_cmd":   "node index.js",
      "port":        3000
    }
  ],
  "env_vars": []
}
```

---

### Auth (Wallet)

**Get nonce**
```
GET /auth/nonce?wallet=0x...
```

**Verify signature → JWT**
```
POST /auth/verify
Content-Type: application/json

{
  "address":   "0x...",
  "nonce":     "zkloud-...",
  "signature": "0x..."
}
```
```json
{ "verified": true, "address": "0x...", "token": "<jwt>" }
```

---

### GitHub OAuth (Private Repos)

**Start OAuth flow**
```
GET /auth/github?wallet=0x...
```
Redirects to GitHub. After callback, token is stored and linked to the wallet.

**List accessible repos**
```
GET /auth/github/repos
Authorization: Bearer <jwt>
```

---

### Workspaces (SSH Dev Environments)

**Allocate a workspace**
```
POST /workspaces
Content-Type: application/json

{
  "team_id":   "team-xxx",
  "ram_mb":    2048,
  "cpu_cores": 2.0
}
```
```json
{
  "container_id": "abc123def456",
  "ssh_host":     "backendapi.comput3.xyz",
  "ssh_port":     32800,
  "app_port":     32801,
  "username":     "hackx",
  "password":     "...",
  "status":       "provisioning | ready | failed"
}
```
> Home directory is LUKS2-encrypted on the host. Key is blockchain-gated via EAS attestation on Base Sepolia.

**Get workspace status**
```
GET /workspaces/:containerID/status
```

**SSH terminal** *(WebSocket)*
```
GET /workspaces/:containerID/ssh
Upgrade: websocket
```

**Destroy workspace**
```
DELETE /workspaces/:containerID
```

---

### Vault (LUKS Key Gate)

**Get nonce for signing**
```
GET /vault/nonce?wallet=0x...
```

**Get vault key** *(requires valid EAS attestation on-chain)*
```
POST /vault/key
Content-Type: application/json

{
  "wallet":     "0x...",
  "nonce":      "zkloud-...",
  "signature":  "0x...",
  "session_id": "sess-xxx"
}
```
```json
{
  "key":             "<hex-32-bytes>",
  "attestation_uid": "0x...",
  "session_id":      "sess-xxx"
}
```

---

### Health

```
GET /health
→ 200 OK
```

---

## Subdomain Access

Every container deployed by the AI agent is accessible at:

```
https://{containerID}.deploy.comput3.xyz/
```

- `containerID` is the 12-char Docker short ID returned in `GET /teams/:teamID/containers`
- No extra configuration needed — subdomain routing is handled by the backend proxy middleware
- Wildcard DNS `*.deploy.comput3.xyz` points to the server; nginx forwards all subdomain traffic to the backend on port 8081

**Example:**
```bash
# Deploy a repo
curl -X POST /sessions -d '{"team_id":"team-xxx","repo_url":"https://github.com/heroku/node-js-getting-started","prompt":"Deploy on port 3000"}'
curl -X POST /sessions/sess-xxx/confirm -d '{"approved":true}'

# Wait for container
curl /teams/team-xxx/containers
# → [{"ID":"f1a4afd49d80","Ports":{"3000/tcp":"32772"}}]

# Hit the app
curl https://f1a4afd49d80.deploy.comput3.xyz/
```
