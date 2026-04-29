# Stellar Integration — Implementation Notes

---

## What Was Built

A parallel Stellar-based trust and payment layer that mirrors the existing Ethereum (EAS + x402) system **without touching or breaking any existing code**.

---

## Folder Structure Created

```
stellar/
├── contracts/
│   └── deployment_contract.rs     ← Soroban smart contract (Rust)
├── scripts/
│   ├── init_escrow.ts             ← Lock funds in escrow
│   ├── submit_proof.ts            ← Submit Merkle root proof
│   └── release_payment.ts        ← Verify proof + release payment
├── types/
│   └── index.ts                   ← Shared TypeScript types
├── config/
│   └── stellar.ts                 ← Network config + env bindings
├── docs/
│   └── architecture.md            ← Mapping: EAS→Stellar, x402→Stellar
└── IMPLEMENTATION.md              ← This file
```

---

## File-by-File Breakdown

---

### `contracts/deployment_contract.rs`

**Language:** Rust (Soroban SDK)  
**Replaces:** `DeploymentEscrow.sol` + `EAS.attest()` on Ethereum

#### What it stores

| Storage Key | Type | Purpose |
|-------------|------|---------|
| `Session(session_id)` | `DeploymentSession` | Escrow record per deployment |
| `Proof(session_id)` | `Proof` | On-chain Merkle root proof per deployment |

#### Data structures

**`DeploymentSession`** — mirrors `Escrow` struct in `DeploymentEscrow.sol`
```rust
pub struct DeploymentSession {
    session_id: Bytes,        // UUID matching backend session
    user: Address,            // who initiated the deployment
    provider: Address,        // who performs the deployment
    token: Address,           // USDC token contract
    amount: i128,             // escrowed amount
    status: PaymentStatus,    // Pending / Completed / Refunded
    created_at_ledger: u32,   // for refund timeout
}
```

**`Proof`** — mirrors EAS attestation data
```rust
pub struct Proof {
    merkle_root: BytesN<32>,          // SHA-256 Merkle root of agent actions
    container_state_hash: BytesN<32>, // hash of final container state
    ipfs_cid: Bytes,                  // IPFS CID of full action log
    submitted_at_ledger: u32,
}
```

**`PaymentStatus`** enum: `Pending` → `Completed` / `Refunded`

#### Functions implemented

| Function | Replaces | Description |
|----------|---------|-------------|
| `init_deployment(user, provider, token, amount, session_id)` | `x402` payment + `DeploymentEscrow.deposit()` | Requires user auth, transfers USDC into contract, creates `Pending` session |
| `submit_proof(provider, session_id, merkle_root, container_state_hash, ipfs_cid)` | `EAS.attest()` | Requires provider auth, stores proof on-chain |
| `verify_and_release(session_id)` | `DeploymentEscrow.release()` | Checks proof exists, transfers USDC to provider, marks `Completed` |
| `refund(user, session_id)` | `DeploymentEscrow.refund()` | Returns USDC if no proof submitted after ~24h (`REFUND_TIMEOUT_LEDGERS = 17_280`) |
| `get_session(session_id)` | — | Read-only: fetch full session record |
| `get_proof(session_id)` | — | Read-only: fetch proof record (like looking up EAS attestation UID) |
| `is_proof_valid(session_id)` | `EAS.isAttestationValid(uid)` | Returns bool — drop-in equivalent |

#### Security properties
- `init_deployment` — requires `user.require_auth()` (prevents front-running)
- `submit_proof` — requires `provider.require_auth()` + validates caller matches session provider
- Duplicate session IDs rejected at creation
- Duplicate proof submissions rejected
- Refund blocked if proof already exists or timeout not elapsed

---

### `scripts/init_escrow.ts`

**Replaces:** `x402` payment header validation + `DeploymentEscrow.deposit()`

**What it does:**
1. Takes `{ user, provider, token, amount, session_id }` as input
2. Builds a Soroban transaction calling `init_deployment()`
3. Signs with provider keypair and submits to Stellar testnet RPC
4. Returns `{ tx_hash, ledger, success }`

**Fallback behaviour:** If `STELLAR_PROVIDER_SECRET_KEY` is not set (dev mode), returns a `SIMULATED_INIT_DEPLOYMENT_...` fake tx hash and logs a warning. This means the rest of the backend works without any Stellar node.

**CLI usage:**
```bash
npx ts-node stellar/scripts/init_escrow.ts \
  --session_id=<UUID> \
  --user=<STELLAR_ADDRESS> \
  --provider=<STELLAR_ADDRESS> \
  --amount=10000
```

---

### `scripts/submit_proof.ts`

**Replaces:** `chain.SubmitAttestation()` in `backend/internal/chain/eas.go`

**What it does:**
1. Takes `{ session_id, merkle_root, container_state_hash, ipfs_cid }` as input
2. Converts `0x`-prefixed hex strings to `BytesN<32>` Soroban ScVal format
3. Calls `submit_proof()` on the Soroban contract
4. Logs explorer URL for the submitted transaction

**Called from:** After `chain.ComputeMerkleRoot()` succeeds in `handlers.go → submitAttestation()`. Can run concurrently with EAS submission — both are independent goroutines.

**CLI usage:**
```bash
npx ts-node stellar/scripts/submit_proof.ts \
  --session_id=<UUID> \
  --merkle_root=0x<64_hex_chars> \
  --container_state_hash=0x<64_hex_chars> \
  --ipfs_cid=<CID>
```

---

### `scripts/release_payment.ts`

**Replaces:** `DeploymentEscrow.release()` triggered by backend after successful deployment

**What it does:**
1. Takes `{ session_id }` as input
2. Calls `verify_and_release()` on the Soroban contract
3. Contract internally checks proof exists before transferring USDC to provider
4. Idempotent — fails gracefully if already released

**Also exports:** `isProofValid(sessionId)` — read-only query equivalent of `EAS.isAttestationValid(uid)`. Uses `simulateTransaction` (no gas cost).

**CLI usage:**
```bash
npx ts-node stellar/scripts/release_payment.ts --session_id=<UUID>
```

---

### `types/index.ts`

Defines all TypeScript interfaces used across scripts and config:

| Type | Maps to |
|------|---------|
| `DeploymentSession` | Soroban `DeploymentSession` struct |
| `Proof` | Soroban `Proof` struct |
| `PaymentState` | Aggregated session + proof view |
| `InitDeploymentParams` | Args for `init_escrow.ts` |
| `SubmitProofParams` | Args for `submit_proof.ts` |
| `VerifyAndReleaseParams` | Args for `release_payment.ts` |
| `RefundParams` | Args for refund flow |
| `ContractResult` | Unified return shape from all scripts |
| `PaymentStatus` | `"Pending" \| "Completed" \| "Refunded"` |

---

### `config/stellar.ts`

Single source of truth for all network constants:

| Export | Value | Notes |
|--------|-------|-------|
| `STELLAR_NETWORK` | `"testnet"` | Change to `"mainnet"` for production |
| `ACTIVE_NETWORK.rpcUrl` | `https://soroban-testnet.stellar.org` | Soroban RPC |
| `ACTIVE_NETWORK.horizonUrl` | `https://horizon-testnet.stellar.org` | Horizon REST |
| `ACTIVE_NETWORK.passphrase` | Testnet SDF passphrase | Required for tx signing |
| `DEPLOYMENT_CONTRACT_ID` | Placeholder C-address | Replace after `stellar contract deploy` |
| `USDC_ASSET_CONTRACT` | Placeholder | Replace with Circle USDC testnet issuer |
| `PROVIDER_SECRET_KEY` | From `STELLAR_PROVIDER_SECRET_KEY` env var | Never hardcode |
| `BASE_FEE` | `100` stroops | ~0.00001 XLM per operation |
| `REFUND_TIMEOUT_LEDGERS` | `17_280` | ~24h at 5s/ledger — must match contract |

---

## Changes to Existing Files (Comments Only)

No logic was modified. Three comment blocks were added:

### `backend/internal/api/handlers.go`
**Location:** Immediately after `merkleRoot := chain.ComputeMerkleRoot(hashes)`  
**Comment:** Shows exact `exec.Command` invocation to call `submit_proof.ts` as a parallel goroutine alongside the existing EAS submission.

### `backend/internal/api/x402.go`
**Location:** Doc comment above `x402Middleware()`  
**Comment:** Describes how to toggle into Stellar payment mode via `STELLAR_MODE=true` — call `init_escrow.ts` instead of validating the `X-PAYMENT` header.

### `backend/internal/chain/eas.go`
**Location:** Doc comment above `SubmitAttestation()`  
**Comment:** Shows how to fire a parallel Stellar `SubmitProof()` goroutine alongside the existing EAS tx, sharing the same `sessionID`, `merkleRoot`, and `ipfsCID`.

---

## How the Two Systems Map to Each Other

| Ethereum | Stellar |
|----------|---------|
| `EAS.attest()` | `submit_proof()` |
| `EAS.isAttestationValid(uid)` | `is_proof_valid(session_id)` |
| Attestation UID (bytes32) | `(CONTRACT_ID, session_id)` tuple |
| `DeploymentEscrow.deposit()` | `init_deployment()` |
| `DeploymentEscrow.release()` | `verify_and_release()` |
| `DeploymentEscrow.refund()` | `refund()` |
| `x402 X-PAYMENT header` | Soroban `init_deployment` tx |
| EAS schema UID | Soroban contract ID |
| BaseScan explorer link | StellarChain explorer link |

---

## Environment Variables to Add

```env
# Stellar / Soroban (add to .env alongside existing Ethereum vars)
STELLAR_NETWORK=testnet
STELLAR_CONTRACT_ID=C...                 # from: stellar contract deploy
STELLAR_USDC_CONTRACT=C...               # Circle USDC testnet issuer
STELLAR_PROVIDER_SECRET_KEY=S...         # provider Stellar keypair — never commit
```

---

## To Deploy the Contract

```bash
# 1. Install Stellar CLI
cargo install --locked stellar-cli --features opt

# 2. Create + fund a testnet identity
stellar keys generate --global comput3-provider --network testnet
stellar keys fund comput3-provider --network testnet

# 3. Build the Soroban contract
cd stellar/contracts
cargo build --target wasm32-unknown-unknown --release

# 4. Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/deployment_contract.wasm \
  --source comput3-provider \
  --network testnet

# 5. Copy the output C-address into:
#    - stellar/config/stellar.ts  →  DEPLOYMENT_CONTRACT_ID
#    - .env                       →  STELLAR_CONTRACT_ID
```

---

## What Is NOT Changed

- `backend/internal/chain/eas.go` — EAS logic untouched
- `backend/internal/api/x402.go` — x402 middleware untouched
- `backend/internal/api/handlers.go` — attestation submission logic untouched
- `contracts/` — all Solidity contracts untouched
- `frontend/` — no changes
- `docker-compose.yml` — no changes
