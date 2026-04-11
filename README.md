# Zkloud — Trustless Agentic Cloud Infrastructure

> **Tagline:** "Every cloud provider asks you to trust them. We're the only one that proves you can't."

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Architecture](#architecture)
5. [Agentic Deployment System](#agentic-deployment-system)
6. [On-Chain Attestation Layer](#on-chain-attestation-layer)
7. [Tech Stack](#tech-stack)
8. [User Flow](#user-flow)
9. [Competitive Landscape](#competitive-landscape)
10. [Revenue Model](#revenue-model)
11. [Go-To-Market Strategy](#go-to-market-strategy)
12. [Hackathon Strategy](#hackathon-strategy)
13. [Roadmap](#roadmap)
14. [FAQ](#faq)
15. [Team & Resources](#team--resources)

---

## Executive Summary

Zkloud is a trustless, AI-powered cloud infrastructure platform that lets developers deploy full-stack environments using natural language — with cryptographic, on-chain proof that nobody (including us) can access their code or data.

We combine three things that no existing platform offers together:

- **Agentic Deployment:** Describe what you need in plain English; an AI agent provisions your entire stack in under 60 seconds.
- **Confidential Compute:** Every container is encrypted at rest with a key only the user holds. Not even the host operator can see inside.
- **On-Chain Attestation:** Every action the agent takes and every container lifecycle event is hashed and recorded on-chain, creating a tamper-proof audit trail anyone can verify.

### Hardware Available

| Resource | Specification |
|----------|---------------|
| RAM | 256 GB |
| Storage | 10 TB SSD |
| Estimated Containers | 50–100 simultaneous |

---

## Problem Statement

### The Trust Gap in Cloud Computing

Every cloud provider today — AWS, GCP, Azure, and even decentralized alternatives — operates on a "trust us" model. When a developer deploys code, they have no way to cryptographically verify that the provider isn't reading their source code, exfiltrating environment variables, injecting backdoors, or monitoring their application behavior.

### Why This Matters at Hackathons

Hackathons are especially vulnerable to this trust gap. Teams are building novel, potentially prize-winning ideas. They're often given shared infrastructure by sponsors or organizers. They have zero visibility into who has root access to the machines they're running on. There's real financial incentive (prize money) to steal ideas. Yet there's no existing solution that lets hackathon organizers provide infrastructure while cryptographically guaranteeing they can't access participant projects.

### The Agent Trust Problem

With the rise of agentic AI in DevOps (Replit Agent, GitHub Copilot Workspace, etc.), a new trust vector emerges: when an AI agent deploys your infrastructure, how do you know it didn't inject a reverse shell into your Dockerfile, exfiltrate your `.env` file during provisioning, install a keylogger alongside your dependencies, or modify your source code before deployment? No existing agentic platform provides verifiable proof of what the agent did.

---

## Solution Overview

Zkloud solves both the cloud trust problem and the agent trust problem in a single platform.

### Three Pillars

**Pillar 1 — Confidential Containers**

Each team gets an isolated Docker container (or set of containers) with filesystem encryption via LUKS, where the encryption key is derived from the team's own keypair. Even with root access on the host, the operator cannot read the team's data. Container isolation is enforced via gVisor or Firecracker sandboxing.

**Pillar 2 — Agentic Deployment**

Instead of requiring teams to write Docker Compose files or configure infrastructure manually, an AI agent handles everything. The user describes their stack in natural language (e.g., "I need React, Express, and MongoDB"). The agent generates a deployment plan, provisions containers, configures networking, installs dependencies, and returns access credentials — all within 60 seconds.

**Pillar 3 — On-Chain Verification**

Every action is logged and attested on-chain. This includes container lifecycle events (created, started, stopped, destroyed), every tool call the agent made during provisioning, a hash of the final container state, and the encryption key derivation proof (proving the operator can't decrypt). Teams can verify their attestation on a block explorer at any time.

---

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    USER LAYER                        │
│                                                     │
│   Web Chat UI  ←→  CLI Tool  ←→  API Endpoint       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                  AGENT LAYER                         │
│                                                     │
│   LLM (Claude/OpenAI) with Function Calling          │
│   ┌─────────────────────────────────────────┐       │
│   │  Tools:                                  │       │
│   │  - create_container(image, resources)    │       │
│   │  - install_package(container, packages)  │       │
│   │  - configure_network(containers, ports)  │       │
│   │  - attach_storage(container, size)       │       │
│   │  - setup_ide(container, type)            │       │
│   │  - generate_keypair()                    │       │
│   └─────────────────────────────────────────┘       │
│                                                     │
│   Action Logger → captures every tool call           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATION LAYER                     │
│                                                     │
│   Container Manager (Go/Python API)                  │
│   - Docker/LXD runtime                               │
│   - LUKS volume encryption per container             │
│   - gVisor/Firecracker sandboxing                    │
│   - Network isolation (per-team VLAN)                │
│   - Resource quota enforcement                       │
│                                                     │
│   256 GB RAM / 10 TB SSD Host Server                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              ATTESTATION LAYER                       │
│                                                     │
│   Smart Contract (Solidity)                          │
│   - Deployed on Base/Arbitrum (low gas)              │
│   - Logs: container hashes, agent action logs,       │
│     lifecycle events, encryption proofs              │
│   - Queryable by anyone via block explorer           │
│                                                     │
│   OR: Ethereum Attestation Service (EAS)             │
└─────────────────────────────────────────────────────┘
```

### Container Architecture (Per Team)

```
┌──────────────────────────────────────┐
│          Team's Encrypted Volume      │
│          (LUKS, team-held key)        │
│  ┌──────────┐  ┌──────────┐          │
│  │ Frontend │  │ Backend  │          │
│  │ (React)  │  │ (Express)│          │
│  │ :3000    │  │ :8080    │          │
│  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐          │
│  │ Database │  │ Web IDE  │          │
│  │ (Mongo)  │  │ (VSCode) │          │
│  │ :27017   │  │ :443     │          │
│  └──────────┘  └──────────┘          │
│                                      │
│  Internal network: team42-net        │
│  External: team42.Zkloud.xyz       │
└──────────────────────────────────────┘
```

### Key Management Flow

```
1. Team signs up → generates Ed25519 keypair in-browser
2. Public key sent to server
3. Server creates LUKS volume, encrypts with derived key
4. Only the team's private key can unlock the volume
5. Server never sees or stores the private key
6. Key derivation proof is hashed and attested on-chain
```

---

## Agentic Deployment System

### Why Agentic?

Traditional cloud platforms require users to understand Docker, Kubernetes, networking, and infrastructure configuration. This is a huge barrier for hackathon participants who just want to start coding. The agentic layer removes this entirely.

### Agent Design

The agent uses an LLM (Claude API or OpenAI) with function calling. It has access to a fixed set of tools — it can never execute arbitrary shell commands. This is both a security feature and a trust feature.

### Available Agent Tools

| Tool | Purpose | Parameters |
|------|---------|------------|
| `create_container` | Spin up a new container | `image`, `ram_mb`, `cpu_cores`, `name` |
| `install_packages` | Install dependencies | `container_id`, `packages[]`, `manager` (npm/pip/apt) |
| `configure_network` | Set up networking | `containers[]`, `exposed_ports[]`, `internal_only[]` |
| `attach_storage` | Mount encrypted storage | `container_id`, `size_gb` |
| `setup_ide` | Install web IDE | `container_id`, `type` (vscode/jupyter) |
| `setup_database` | Configure database | `type` (postgres/mongo/redis/mysql), `version` |
| `generate_keypair` | Create encryption keys | `algorithm` (ed25519/rsa) |
| `health_check` | Verify container status | `container_id` |
| `get_logs` | Retrieve container logs | `container_id`, `lines` |
| `destroy_container` | Tear down container | `container_id` |

### Agent Guardrails

The agent operates under strict constraints. It can only call the predefined tools listed above — no raw shell access, no filesystem access outside mounted volumes, no network calls to external services. Every tool call is appended to an immutable action log that gets hashed and attested on-chain.

### Example Interaction

```
User: "I'm building a DeFi analytics dashboard. 
       Need React frontend, Python FastAPI backend 
       with pandas, and PostgreSQL."

Agent Thinking:
  - Frontend: Node 20 container, React, port 3000
  - Backend: Python 3.12 container, FastAPI + pandas, port 8000
  - Database: PostgreSQL 16, port 5432 (internal only)
  - Need internal network between all three
  - Web IDE for convenience

Agent Actions:
  1. generate_keypair(algorithm="ed25519")
  2. create_container(image="node:20", ram_mb=2048, name="frontend")
  3. create_container(image="python:3.12", ram_mb=4096, name="backend")
  4. setup_database(type="postgres", version="16")
  5. install_packages(container="frontend", packages=["react","vite"], manager="npm")
  6. install_packages(container="backend", packages=["fastapi","pandas","uvicorn","psycopg2"], manager="pip")
  7. configure_network(
       containers=["frontend","backend","postgres"],
       exposed_ports=[3000, 8000],
       internal_only=[5432]
     )
  8. setup_ide(container="frontend", type="vscode")
  9. attach_storage(container="backend", size_gb=10)

Agent Response:
  "Your DeFi analytics stack is ready:

   ✅ React frontend    → https://team42.Zkloud.xyz:3000
   ✅ FastAPI backend    → https://team42.Zkloud.xyz:8000
   ✅ PostgreSQL 16      → internal (backend can reach it at postgres:5432)
   ✅ VS Code IDE        → https://team42.Zkloud.xyz/ide
   ✅ 10 GB encrypted storage mounted to backend

   🔑 Your encryption key: [saved to browser, never sent to server]
   🔗 On-chain attestation: https://basescan.org/tx/0x4a2f...
   
   SSH access: ssh team42@Zkloud.xyz

   All 9 agent actions are logged in the attestation.
   Verify anytime that nothing extra was executed."
```

### Agent Action Log Format

Every tool call is logged in a structured format:

```json
{
  "session_id": "team42-deploy-001",
  "timestamp": "2026-04-11T14:30:00Z",
  "actions": [
    {
      "index": 0,
      "tool": "generate_keypair",
      "params": {"algorithm": "ed25519"},
      "result": {"public_key": "0x7f3a..."},
      "hash": "sha256:abc123..."
    },
    {
      "index": 1,
      "tool": "create_container",
      "params": {"image": "node:20", "ram_mb": 2048, "name": "frontend"},
      "result": {"container_id": "ctr-9f8e7d", "status": "running"},
      "hash": "sha256:def456..."
    }
  ],
  "merkle_root": "sha256:final789...",
  "attested_tx": "0x4a2f..."
}
```

The `merkle_root` of all action hashes is what gets stored on-chain. Anyone can recompute the root from the action log to verify nothing was tampered with.

---

## On-Chain Attestation Layer

### What Gets Attested

| Event | Data Stored On-Chain | Purpose |
|-------|---------------------|---------|
| Container Created | Hash of config + image ID | Prove what was deployed |
| Agent Actions | Merkle root of action log | Prove no unauthorized actions |
| Container Started | Timestamp + state hash | Prove when environment was live |
| Container Stopped | Timestamp + final state hash | Prove data wasn't modified after |
| Key Derivation | Proof that operator can't decrypt | Prove confidentiality |
| Container Destroyed | Timestamp + deletion proof | Prove data was wiped |

### Smart Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZkloudAttestation {
    
    struct Attestation {
        bytes32 teamId;
        bytes32 actionMerkleRoot;
        bytes32 containerStateHash;
        bytes32 encryptionProof;
        uint256 timestamp;
        AttestationType attestationType;
    }
    
    enum AttestationType {
        CONTAINER_CREATED,
        AGENT_DEPLOYMENT,
        CONTAINER_STARTED,
        CONTAINER_STOPPED,
        CONTAINER_DESTROYED
    }
    
    mapping(bytes32 => Attestation[]) public teamAttestations;
    
    event AttestationCreated(
        bytes32 indexed teamId,
        bytes32 actionMerkleRoot,
        AttestationType attestationType,
        uint256 timestamp
    );
    
    function attest(
        bytes32 _teamId,
        bytes32 _actionMerkleRoot,
        bytes32 _containerStateHash,
        bytes32 _encryptionProof,
        AttestationType _type
    ) external {
        Attestation memory a = Attestation({
            teamId: _teamId,
            actionMerkleRoot: _actionMerkleRoot,
            containerStateHash: _containerStateHash,
            encryptionProof: _encryptionProof,
            timestamp: block.timestamp,
            attestationType: _type
        });
        
        teamAttestations[_teamId].push(a);
        
        emit AttestationCreated(
            _teamId,
            _actionMerkleRoot,
            _type,
            block.timestamp
        );
    }
    
    function getAttestations(bytes32 _teamId) 
        external view returns (Attestation[] memory) 
    {
        return teamAttestations[_teamId];
    }
    
    function verifyActionLog(
        bytes32 _teamId,
        uint256 _index,
        bytes32[] calldata _actionHashes
    ) external view returns (bool) {
        bytes32 computedRoot = _computeMerkleRoot(_actionHashes);
        return computedRoot == teamAttestations[_teamId][_index].actionMerkleRoot;
    }
    
    function _computeMerkleRoot(bytes32[] calldata leaves) 
        internal pure returns (bytes32) 
    {
        // Standard merkle root computation
        // ... implementation
    }
}
```

### Alternative: Ethereum Attestation Service (EAS)

Instead of a custom contract, Zkloud can use EAS for attestations. EAS is a public good for making attestations on-chain or off-chain. It provides a standardized schema system, is already deployed on multiple chains, and has existing block explorer integration.

Schema for Zkloud attestations:

```
bytes32 teamId,
bytes32 actionMerkleRoot,
bytes32 containerStateHash,
uint8 attestationType,
string actionLogIPFS
```

### Verification Flow for End Users

```
1. Team receives attestation tx hash after deployment
2. Team visits block explorer (e.g., BaseScan)
3. They can see: timestamp, action merkle root, container state hash
4. They download the full action log (stored on IPFS or served via API)
5. They recompute the merkle root locally
6. If it matches the on-chain value → agent did exactly what it claimed
7. If it doesn't match → tampering detected
```

---

## Tech Stack

### Core Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Host OS | Ubuntu 24.04 LTS | Stability, Docker support |
| Container Runtime | Docker + gVisor | Isolation + security |
| Orchestration API | Go or Python (FastAPI) | Lightweight, fast |
| Encryption | LUKS2 | Linux standard, battle-tested |
| Key Exchange | X25519 (Curve25519) | Fast, secure, modern |

### Agent Layer

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| LLM | Claude API (Sonnet) | Function calling, fast, cost-effective |
| Tool Framework | Custom function definitions | Constrained tool set for security |
| Action Logger | Append-only JSON log | Tamper-evident |
| Hash Function | SHA-256 | Standard, verifiable |

### Blockchain Layer

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Chain | Base (Ethereum L2) | Low gas, fast finality, EVM |
| Contract Language | Solidity | Standard, auditable |
| Attestation | Custom contract or EAS | Flexibility |
| Action Log Storage | IPFS (via Pinata/web3.storage) | Decentralized, permanent |

### Frontend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Landing Page | Next.js / React | Fast, modern |
| Chat Interface | Custom React component | Agent interaction |
| Dashboard | React + Recharts | Live container monitoring |
| Wallet Connect | RainbowKit + wagmi | Standard web3 UX |
| Web IDE | code-server (VS Code) | Familiar to developers |

### Quick Start for Users

```bash
# One-line setup
curl https://Zkloud.xyz/claim | sh

# Or via the web UI
# 1. Visit Zkloud.xyz
# 2. Connect wallet
# 3. Describe your stack
# 4. Start coding
```

---

## User Flow

### Step-by-Step Journey

```
STEP 1: SIGN UP
├── Visit Zkloud.xyz
├── Connect wallet (MetaMask, Rainbow, etc.)
├── Keypair generated in-browser (never leaves device)
└── Team name registered

STEP 2: DESCRIBE STACK
├── Chat with AI agent via web UI or CLI
├── "I need a full-stack app with React, Node, and Postgres"
├── Agent generates deployment plan
└── User confirms plan

STEP 3: DEPLOYMENT (< 60 seconds)
├── Agent executes tool calls sequentially
├── Each action logged to action log
├── Containers created with encrypted volumes
├── Networking configured
├── Dependencies installed
├── Web IDE attached
└── Action log hashed → merkle root computed

STEP 4: ATTESTATION
├── Merkle root of action log sent to smart contract
├── Container state hash attested
├── Encryption proof attested
├── User receives tx hash
└── Verification link generated

STEP 5: DEVELOP
├── SSH into containers
├── Use web IDE (VS Code in browser)
├── All data encrypted at rest
├── Operator has zero access to contents
└── Additional agent commands available ("add Redis", "scale API")

STEP 6: VERIFY (anytime)
├── Visit verification dashboard
├── View all attestations for your team
├── Download full action log
├── Recompute merkle root locally
└── Compare with on-chain value

STEP 7: TEARDOWN
├── Team requests container destruction
├── Agent executes destroy commands
├── Destruction attested on-chain
├── Encrypted volumes wiped
└── Final attestation proves data is gone
```

---

## Competitive Landscape

### Market Map

| Platform | Deployment UX | Confidentiality | On-Chain Attestation | Target User |
|----------|--------------|-----------------|---------------------|-------------|
| **AWS / GCP / Azure** | Manual / CLI | Trust-based | None | Enterprise |
| **Fluence** | Manual / CLI | Roadmap (exploring TEE) | Billing only | AI/ML teams |
| **Akash Network** | CLI / Console | None | Billing SLAs | Cost-conscious devs |
| **Phala Network** | SDK / CLI | TEE-based | Yes (compute proofs) | Privacy-focused apps |
| **Replit Agent** | Conversational | Trust-based | None | Beginners |
| **GitHub Copilot Workspace** | Conversational | Trust-based | None | GitHub users |
| **Zkloud (Us)** | Conversational | Encryption + proofs | Full action log | Hackathon teams, prototypers |

### Why Not Fluence?

Fluence is building a decentralized AWS — a general-purpose compute marketplace. Key differences:

1. **Fluence has no confidential compute today.** Confidential computing with TEEs is listed as an R&D exploration item on their roadmap, not a shipping feature. For Zkloud, it's the core product.

2. **Fluence requires DevOps knowledge.** Users need to understand containers, configure deployments, and manage infrastructure through their console. Zkloud uses natural language — "I need React and MongoDB" — and an AI agent handles everything.

3. **Fluence targets enterprise AI workloads.** Their 2026 focus is GPU compute for ML inference and training. Zkloud targets developers who need rapid prototyping environments with trust guarantees.

4. **Different business model.** Fluence is a token-driven marketplace (FLT) connecting compute suppliers and buyers. Zkloud is a product — a specific, opinionated experience for a specific use case.

**Analogy:** Fluence is to Zkloud what AWS is to Replit. Same underlying category (cloud compute), completely different product, user, and experience.

### Why Not Phala?

Phala is the closest competitor in the confidentiality space, but still different.

Phala focuses on confidential smart contract execution and AI agent hosting using TEEs. They're built for running specific privacy-preserving computations (AI inference, secret management, darkpool DEXes). Zkloud provides general-purpose development environments. Phala requires learning their SDK and programming model. Zkloud is "describe and deploy." Phala doesn't have an agentic interface, and there is no natural language deployment.

### Why Not Akash?

Akash is purely a compute marketplace — cheapest price wins. They provide no confidentiality guarantees. They even sponsored a hackathon by providing free cloud, but without any privacy angle — teams had to trust Akash operators. Zkloud would have solved the exact problem Akash left open.

### Our Unique Position

Zkloud occupies the only quadrant that combines agentic deployment with verifiable confidentiality. Every competitor is missing at least one of these two properties. This isn't a "we do it better" argument — it's a "nobody else does this at all" argument.

---

## Revenue Model

### Phase 1: Hackathon-as-a-Service (B2B) — Months 1–6

Sell to hackathon organizers (ETHGlobal, MLH, Devfolio, etc.) as the infrastructure provider for their events.

| Metric | Value |
|--------|-------|
| Price per event | $2,000 – $10,000 (depending on scale) |
| Events per year (addressable) | 200+ |
| Revenue potential | $400K – $2M/year |
| Cost per event | ~$200–500 (compute + gas) |
| Gross margin | 80–90% |

**Value prop to organizers:** Participants get free, private compute. Organizers get engagement dashboards (anonymized). Nobody worries about IP theft. It's a differentiator for their event.

### Phase 2: Self-Serve Platform (B2C) — Months 6–12

Developers sign up individually and pay for compute.

**Tiered Pricing:**

| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | 1 container, 2 GB RAM, 10 GB storage, 24hr lifetime |
| Pro | $20/month | AI agent deployment, 5 containers, 16 GB RAM, 100 GB storage |
| Team | $50/month | Shared environments, secrets management, CI/CD agent, 32 GB RAM |

**Usage-based compute fees (on top of tier):**

| Resource | Price |
|----------|-------|
| Container-hour | $0.05 |
| GB RAM per hour | $0.01 |
| GB storage per month | $0.10 |
| On-chain attestation | $0.05 (includes gas) |

### Phase 3: Decentralized Network — Months 12–24

Allow other server owners to join the network and contribute hardware.

- Zkloud takes a 10–15% protocol fee on every transaction.
- Compute providers stake tokens to participate.
- Quality is enforced via attestation — providers with mismatched attestations get slashed.

### Revenue Math (Single Server)

| Metric | Value |
|--------|-------|
| Simultaneous containers | 50–100 |
| Average utilization | 70% |
| Revenue per container-hour | $0.05 |
| Daily revenue | $84 – $168 |
| Monthly revenue | $2,520 – $5,040 |
| Hardware cost (one-time) | ~$3,000 – $5,000 |
| Break-even | Month 1–2 |

### Additional Revenue Streams

**Template Marketplace (Commission):** Developers publish verified deployment templates (e.g., "Production Next.js + Supabase + Redis"). When used, creator gets 80%, Zkloud takes 20%.

**Attestation Premium (Enterprise):** Companies needing compliance-grade audit trails (healthcare, fintech, legal) pay $500–2,000/month for enhanced attestation with regulatory metadata.

**Token Model (Optional, Long-term):** A utility token for compute payment (with discount vs stablecoins), provider staking, governance, and template creator rewards. This is the fundraising play if pursuing crypto VC, but not the primary business model.

---

## Go-To-Market Strategy

### Phase 1: Hackathon Domination (Months 1–3)

**Objective:** Become the default infrastructure for web3 hackathons.

- **Launch at a major ETHGlobal event** by offering free cloud to every team.
- **Be your own best case study:** You're a hackathon project that runs the hackathon's infrastructure. This is inherently viral.
- **Create FOMO:** Live dashboard on a big screen showing containers spinning up in real-time with on-chain attestation links.
- **Dev evangelism:** "We're so confident in our privacy that our competitors use our infra."

### Phase 2: Developer Community (Months 3–6)

**Objective:** Build organic adoption beyond hackathons.

- Open self-serve signups with a generous free tier.
- Create one-click deploy templates for popular stacks.
- Publish technical content: "How We Built a Trustless Cloud" blog series.
- Integrate with GitHub — deploy from any repo via the agent.
- Target web3 developers first (they understand attestations natively), then expand.

### Phase 3: Enterprise & Protocol Partnerships (Months 6–12)

**Objective:** Land recurring B2B contracts.

- Partner with L2 chains (Base, Arbitrum, Optimism) as the recommended dev environment for their ecosystems.
- Offer whitelabel solutions for companies running internal hackathons (Google, Meta, etc.).
- Pursue compliance-heavy verticals: healthcare startups, fintech prototyping, legal tech.

### Buzz Tactics for Hackathon Launch

| Tactic | Why It Works |
|--------|-------------|
| Name it something catchy ("Zkloud") | Memorable, implies invisibility/privacy |
| Live dashboard on big screen | Visual spectacle, social proof |
| One-line deploy (`curl ... \| sh`) | Viral "wow" moment |
| "Verify us" challenge | Dare people to try to see inside — they can't |
| Free for every team | Removes friction, maximizes adoption |
| Tweet-ready attestation links | Organic social sharing |
| "Our competitors use our infra" | Narrative gold |

---

## Hackathon Strategy

### What to Build in 48 Hours

**Priority 1 — Must Have (Day 1):**
- Container orchestration API (create, start, stop, destroy)
- LUKS encryption per container with user-held keys
- Smart contract for attestation (deploy on Base Sepolia testnet)
- Basic agent with 3–4 tools (create_container, install_packages, configure_network)

**Priority 2 — Should Have (Day 2, first half):**
- Web chat UI for agent interaction
- Live dashboard showing containers and attestation tx links
- Action log → merkle root → on-chain attestation pipeline
- Web IDE (code-server) auto-provisioning

**Priority 3 — Nice to Have (Day 2, second half):**
- Landing page with demo video
- Template marketplace (even with 3–5 templates)
- Verification tool (paste action log, verify against on-chain root)
- Multi-container networking

### Demo Script (4 minutes)

```
[0:00 - 0:30] Problem Statement
"Every cloud provider asks you to trust them. We built 
the first one that proves you can't see our users' data."

[0:30 - 1:30] Live Demo: Agentic Deployment
- Open Zkloud chat UI
- Type: "I need a React app with Express and MongoDB"
- Show agent provisioning in real-time
- Show attestation tx on BaseScan

[1:30 - 2:30] Trust Verification
- Show the action log (every tool call)
- Recompute merkle root live
- Match against on-chain value
- "If we had injected anything, the hash wouldn't match"

[2:30 - 3:15] Architecture & Differentiators
- Quick architecture slide
- Competitive positioning vs Fluence/Akash/Phala
- "Nobody combines agentic UX + verifiable privacy"

[3:15 - 4:00] Business Model & Vision
- Hackathon-as-a-Service → Self-serve → Decentralized network
- "We're running THIS hackathon's infrastructure right now"
- Revenue math: break-even month 1
```

### Prize Categories to Target

| Category | Why Zkloud Fits |
|----------|-------------------|
| Best Infrastructure / DevTools | We ARE infrastructure |
| Best Use of [L2 Chain] | Attestation contract deployed on their chain |
| Most Innovative | Agentic + confidential + on-chain is novel |
| Best AI Project | Agentic deployment system |
| Best UX | 60-second natural language deploy |

---

## Roadmap

### Short Term (Hackathon Build — Week 1)

- [ ] Container orchestration API
- [ ] LUKS encryption integration
- [ ] Smart contract deployment (Base Sepolia)
- [ ] AI agent with function calling (5 tools)
- [ ] Web chat UI
- [ ] Action log → attestation pipeline
- [ ] Landing page

### Medium Term (Post-Hackathon — Months 1–3)

- [ ] Production deployment on mainnet (Base/Arbitrum)
- [ ] Self-serve signups with free tier
- [ ] Template marketplace (10+ templates)
- [ ] GitHub integration (deploy from repo)
- [ ] CI/CD agent capabilities
- [ ] Mobile-responsive dashboard
- [ ] Documentation site

### Long Term (Months 3–12)

- [ ] Multi-node support (other servers join network)
- [ ] GPU container support
- [ ] Token launch (if pursuing decentralization)
- [ ] Enterprise whitelabel solution
- [ ] SOC2 / compliance certifications
- [ ] Formal security audit of encryption layer
- [ ] SDK for programmatic access

---

## FAQ

### General

**Q: What is Zkloud?**
A: Zkloud is a trustless cloud infrastructure platform where developers deploy full-stack environments using natural language, with cryptographic proof that nobody — including us — can access their code or data.

**Q: How is this different from AWS/GCP?**
A: AWS asks you to trust them. Zkloud proves trustlessness with on-chain attestations. Also, you deploy by chatting with an AI agent instead of configuring infrastructure manually.

**Q: How is this different from Fluence?**
A: Fluence is a decentralized AWS — a general-purpose compute marketplace. They don't have confidential compute (it's on their roadmap as R&D). They don't have an agentic interface. They target enterprise AI workloads. Zkloud combines agentic deployment + verifiable privacy, targeting rapid prototyping and hackathons. Think Replit vs AWS — same category, different product.

**Q: How is this different from Phala?**
A: Phala focuses on confidential smart contract execution and AI agent hosting using TEEs. Zkloud provides general-purpose development environments with an AI agent that handles deployment. Phala requires learning their SDK; Zkloud requires describing what you want in English.

**Q: How is this different from Akash?**
A: Akash is a compute marketplace focused on cheapest price. They provide zero confidentiality guarantees. When Akash sponsored a hackathon with free cloud, teams had no way to verify their IP was safe. Zkloud solves that exact problem.

**Q: How is this different from Replit Agent?**
A: Replit Agent is a fantastic agentic coding platform, but it's centralized and trust-based. Replit can see everything you build. Zkloud provides a similar agentic experience but with cryptographic privacy guarantees and on-chain proof.

### Technical

**Q: How do you guarantee you can't see my data?**
A: Your container's filesystem is encrypted with LUKS. The encryption key is derived from your keypair, which is generated in your browser and never sent to our server. We physically cannot decrypt your volume. This is proven on-chain via a key derivation attestation.

**Q: What if the agent injects malicious code?**
A: Every action the agent takes is logged in a signed action log. The merkle root of this log is attested on-chain. You can download the full log, recompute the root, and verify it matches. If we injected anything, the hash wouldn't match. Additionally, the agent can only call predefined tools — it has no raw shell access.

**Q: What blockchain do you use?**
A: We deploy on Base (Ethereum L2) for low gas costs and fast finality. Attestations cost fractions of a cent. We can also support Arbitrum, Optimism, or any EVM chain.

**Q: What happens if your server goes down?**
A: Your data is encrypted on disk — it persists across reboots. Attestations are on-chain and permanent. In the decentralized version (roadmap), your containers can be migrated to other providers without losing the trust guarantees.

**Q: Can I use my own Docker images?**
A: Yes. The agent can deploy any public Docker image. For custom images, you push to a registry and the agent pulls from there.

### Business

**Q: How do you make money?**
A: Three phases. Phase 1: sell to hackathon organizers ($2K–$10K per event). Phase 2: self-serve developer platform (freemium + usage-based). Phase 3: protocol fees on a decentralized compute network.

**Q: What's your unfair advantage?**
A: We're the only platform combining agentic deployment with verifiable confidentiality. Competitors have one or the other — never both. Our moat deepens with data: the more deployments the agent handles, the smarter it gets at provisioning.

**Q: What's your TAM?**
A: Cloud computing is $723B+ in 2026. The immediately addressable market is hackathon infrastructure ($50M+ annually across thousands of events) and developer prototyping tools ($5B+ market including Replit, Railway, Vercel, etc.).

**Q: Why would someone trust a hackathon project with their infrastructure?**
A: They don't have to trust us — that's the entire point. The encryption and attestation system means trust is verified, not assumed. We're dogfooding this by running our competitors' infrastructure at the very hackathon where we're competing.

---

## Team & Resources

### Required Skills

| Role | Responsibility |
|------|---------------|
| Backend / Infra Engineer | Container orchestration, LUKS encryption, API |
| Smart Contract Developer | Attestation contract, deployment, verification |
| AI/Agent Developer | LLM integration, tool definitions, action logging |
| Frontend Developer | Chat UI, dashboard, landing page |

### Key Resources

| Resource | Link |
|----------|------|
| Docker SDK for Python | https://docker-py.readthedocs.io |
| Claude API (Function Calling) | https://docs.anthropic.com |
| LUKS / cryptsetup | https://man7.org/linux/man-pages/man8/cryptsetup.8.html |
| Ethereum Attestation Service | https://attest.org |
| Base (L2) | https://base.org |
| code-server (Web IDE) | https://github.com/coder/code-server |
| gVisor (Container Sandbox) | https://gvisor.dev |
| RainbowKit (Wallet Connect) | https://www.rainbowkit.com |

### Estimated Development Time (Hackathon MVP)

| Component | Hours |
|-----------|-------|
| Container orchestration API | 8 |
| LUKS encryption integration | 4 |
| Smart contract + deployment | 4 |
| AI agent + tools | 6 |
| Action log → attestation pipeline | 4 |
| Chat UI | 6 |
| Dashboard | 4 |
| Landing page | 3 |
| Integration testing | 4 |
| Demo prep | 3 |
| **Total** | **~46 hours** |

---

## License

This project documentation is provided for hackathon submission and development purposes. All architecture, designs, and concepts described herein are original work.

---

*Built with conviction that the future of cloud computing is trustless, agentic, and verifiable.*
