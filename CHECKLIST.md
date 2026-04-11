# zkLOUD — Build Checklist
> Multi-agent coordination file. Follow the protocol below strictly so agents never step on each other.

**Status legend:** `[ ]` pending · `[WIP: <agent>]` in progress · `[DONE]` complete · `[BLOCKED: reason]` blocked

---

## Agent Protocol — READ BEFORE STARTING ANY TASK

1. **Claim the task** — change `[ ]` to `[WIP: your-name]` in this file
2. **Commit and push immediately** — before writing a single line of code:
   ```
   git add CHECKLIST.md
   git commit -m "chore: claim task <id> [your-name]"
   git push
   ```
3. **Now start working** — other agents will see the push and won't duplicate your work
4. **When done** — change `[WIP: your-name]` to `[DONE]`, commit all your work, push:
   ```
   git add .
   git commit -m "feat: complete task <id> — <short description>"
   git push
   ```
5. **Never start a task already marked `[WIP]`** — pull first, check the file, then claim
6. **Always pull before claiming** — run `git pull` before editing this file to avoid conflicts

---

## 1. Smart Contracts
_Directory: `/contracts`_
_Chain: Base Sepolia testnet_

- [DONE] **1.1** Initialize Hardhat/Foundry project in `/contracts`
- [DONE] **1.2** Write `ProviderRegistry.sol` — providers register with: `endpoint`, `pricePerHour`, `stakedAmount`, `slashCount`, `jobsCompleted`, `active`; include `stake()`, `unstake()`, `slash(address provider, bytes32 evidence)` functions; `select_provider()` filters by `active == true && stakedAmount >= MIN_STAKE`
- [DONE] **1.3** Write `DeploymentEscrow.sol` — streaming 20%/80% escrow: startSession, releasePayment, submitProof, stopSession, slashProvider; interfaces with ProviderRegistry for on-chain slashing
- [DONE] **1.4** Register zkLOUD EAS schema on Base Sepolia (`teamId, actionMerkleRoot, containerStateHash, sessionId, ipfsCid`)
- [DONE] **1.5** Deploy contracts to Base Sepolia + save addresses to `/contracts/deployments.json`
- [DONE] **1.6** Generate TypeScript ABIs for frontend consumption

---

## 2. Backend — New Features
_Directory: `/backend`_
_Existing: container manager, agent loop, API, store — all compile_

- [DONE] **2.1** Add `analyze_repo(github_url)` agent tool — clone repo, detect stack from `package.json` / `requirements.txt` / `Dockerfile` / `hardhat.config.js` / `foundry.toml`
- [ ] **2.1.1** Private repo support — GitHub OAuth connector; store access token per team; pass token to `git clone` via `https://x-access-token:<token>@github.com/...`; add `POST /auth/github` + `GET /auth/github/callback` endpoints
- [DONE] **2.2** Add `select_provider()` agent tool — query `ProviderRegistry` contract; filter by `active && stakedAmount >= MIN_STAKE`; rank by `pricePerHour ASC`, then `jobsCompleted DESC` as tiebreaker; return winning provider's `endpoint` URL for the agent to route the deployment request to
- [DONE] **2.3** Add `generate_deployment_plan()` agent tool — return structured plan (containers, ports, estimated cost) before executing, await user confirmation
- [DONE] **2.4** Implement x402 payment verification middleware — verify `X-PAYMENT` header on compute request endpoints before provisioning; **this runs on every provider node**, not just the central orchestrator — node refuses to provision if payment is absent or invalid
- [DONE] **2.5** Implement EAS attestation submission after session completes — hash action log, submit to EAS schema; **provider node submits the attestation** (not the orchestrator), so the on-chain record is tied to the node's wallet address — makes providers individually accountable
- [DONE] **2.6** Add `POST /sessions/:id/confirm` endpoint — user approves the plan before agent executes
- [DONE] **2.7** Add wallet-based auth — `POST /auth/nonce`, `POST /auth/verify` (EIP-191 signature verification)
- [DONE] **2.8** Store provider info + payment tx references in Postgres
- [DONE] **2.9** Add `GET /attestations/:sessionId` endpoint — return EAS attestation link for a session

---

## 3. Frontend — Chat + Dashboard App
_Directory: `/frontend`_
_Framework: Next.js (already initialized, blank)_

- [ ] **3.1** Add RainbowKit + wagmi — wallet connect with Base Sepolia network config
- [ ] **3.2** Build GitHub URL input page (`/`) — text input, submit triggers `POST /sessions`
- [ ] **3.3** Build deployment plan review page (`/sessions/:id/plan`) — show agent's plan, cost estimate, confirm/reject buttons
- [ ] **3.4** Build live deployment stream page (`/sessions/:id`) — WebSocket client, render agent events as a step-by-step feed
- [ ] **3.5** Build dashboard page (`/dashboard`) — list all team containers, ports, status, attestation links
- [ ] **3.6** Fund agent wallet UI — show USDC balance, deposit flow
- [ ] **3.7** Build attestation verify page (`/verify/:sessionId`) — show action log, merkle root, EAS link, "verify yourself" instructions
- [ ] **3.8** Wire wallet auth — sign nonce on connect, send JWT to backend

---

## 4. Landing Page
_Directory: `/landing`_
_Framework: Next.js (already initialized, blank)_

- [ ] **4.1** Hero section — tagline, animated terminal showing a live deploy
- [ ] **4.2** How it works — 4-step visual: Paste repo → Agent analyzes → Compute sourced → Verified on-chain
- [ ] **4.3** Why trustless section — compare trust-based (AWS) vs verifiable (zkLOUD)
- [ ] **4.4** CTA — "Try it now" → links to frontend app
- [ ] **4.5** Provider section — "Run a node, earn USDC" with link to provider docs

---

## 5. Infrastructure
_Root directory_

- [ ] **5.1** Update `docker-compose.yml` — add nginx reverse proxy for routing `team-{id}.zkloud.xyz` → correct container port
- [ ] **5.2** Add `.env.example` entries for new vars: `EAS_SCHEMA_UID`, `PROVIDER_REGISTRY_ADDRESS`, `AGENT_WALLET_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`
- [ ] **5.3** Write provider node setup script — `scripts/setup-provider.sh`: installs Docker, pulls backend image, sets `PROVIDER_WALLET_PRIVATE_KEY` + `STAKE_AMOUNT_USDC` from env, calls `ProviderRegistry.stake()` on-chain, starts backend with x402 middleware enabled; **run this on your server (Provider #1) + 2 teammate machines (Provider #2, #3)** to demo a live 3-node marketplace
- [ ] **5.4** End-to-end test: paste a real GitHub repo URL → containers running → attestation on-chain

---

## 6. Demo Prep
- [ ] **6.1** Pick 2–3 demo repos (simple Next.js app, React + Express, web3 dapp with Hardhat)
- [ ] **6.2** Record fallback demo video in case live demo fails
- [ ] **6.3** Prepare BaseScan links showing live attestations
- [ ] **6.4** Write 4-minute demo script (see README §Hackathon Strategy)
- [ ] **6.5** Register all 3 provider nodes in `ProviderRegistry` on Base Sepolia before demo — confirm all show `active: true` on the frontend provider list
- [ ] **6.6** Demo narrative beat: show `ProviderRegistry` on BaseScan → agent picks cheapest node → x402 payment tx → containers up → EAS attestation from *provider's* wallet → "nobody controls this, not even us"

---

## Dependency order

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
                                  ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5 ← 1.5
        ↑              ↑
       1.2 (stake)    2.4 (x402 on node)
                    ↓
              2.6, 2.7, 2.8, 2.9

3.1 → 3.2 → 3.3 → 3.4 → 3.5
3.1 → 3.6
3.1 → 3.7 ← 2.9
3.8 ← 2.7

4.x  (fully independent, no blockers)
5.1  (needs 2.x done)
5.3  (needs 1.2 done — stake() call in setup script)
5.4  (needs everything done)
6.5  (needs 5.3 × 3 nodes done)
6.6  (needs 6.5 done)
```

---

## Parallel tracks (can run simultaneously)

| Track | Tasks | Who |
|---|---|---|
| **Contracts** | 1.1 → 1.6 | |
| **Backend features** | 2.1, 2.2, 2.3 | |
| **Backend auth + payment** | 2.4, 2.7 | |
| **Frontend shell + wallet** | 3.1, 3.2, 3.8 | |
| **Landing page** | 4.1 → 4.5 | |

---

_Last updated: 2026-04-11_
