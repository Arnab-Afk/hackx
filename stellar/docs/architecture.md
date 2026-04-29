# Stellar Integration Architecture

## Overview

COMPUT3 uses a **dual-chain trust and payment model**:

| Concern | Ethereum (existing) | Stellar (this module) |
|---------|--------------------|-----------------------|
| Proof storage | EAS attestation on Base Sepolia | Soroban contract storage (`submit_proof`) |
| Payment escrow | x402 `X-PAYMENT` header + `DeploymentEscrow.sol` | `init_deployment` in `deployment_contract.rs` |
| Payment release | `DeploymentEscrow.release()` (backend-triggered) | `verify_and_release()` (backend-triggered) |
| Refund | `DeploymentEscrow.refund()` after 24 h | `refund()` after `REFUND_TIMEOUT_LEDGERS` (~24 h) |
| Provider accountability | On-chain slash via `ProviderRegistry.slash()` | Future: Stellar soroban slashing module |

The two layers are **fully independent** — either can be disabled without breaking the other.

---

## How EAS Maps to Stellar

### EAS Attestation → `submit_proof()`

On Ethereum:

```
1. Agent completes deployment
2. Compute Merkle root of all action hashes (SHA-256)
3. Call chain.SubmitAttestation(rpcURL, privKey, schemaUID, sessionID, teamID, merkleRoot, containerStateHash, ipfsCID)
4. EAS contract stores: { schema, recipient, data: (teamId, actionMerkleRoot, containerStateHash, sessionId, ipfsCid) }
5. Returns attestationUID (bytes32) — used later to derive vault key
```

On Stellar (parallel):

```
1. (same) Agent completes deployment
2. (same) Compute Merkle root
3. Call stellar/scripts/submit_proof.ts with { session_id, merkle_root, container_state_hash, ipfs_cid }
4. Soroban contract stores Proof { merkle_root, container_state_hash, ipfs_cid, submitted_at_ledger }
5. Returns Stellar tx_hash — proof retrievable via get_proof(session_id)
```

**Equivalence:**

| EAS concept | Stellar equivalent |
|-------------|-------------------|
| `attestationUID` | `(CONTRACT_ID, session_id)` — uniquely identifies the proof |
| `EAS.isAttestationValid(uid)` | `is_proof_valid(session_id)` |
| `EAS.attest(request)` → tx | `submit_proof(...)` → tx |
| Revocation via `EAS.revoke()` | Future: `invalidate_proof(session_id)` — admin-only |

---

## How x402 Maps to Stellar

### x402 Payment Header → `init_deployment()`

On Ethereum (current flow):

```
1. User sends POST /sessions with X-PAYMENT: base64(JSON{ from, to, value, nonce, sig })
2. x402Middleware validates: to == providerWallet, value >= requiredUsdc, nonce not replayed
3. Backend calls chain.ExecuteTransferWithAuthorization() to pull USDC from user → provider
4. Session starts
```

On Stellar (parallel flow):

```
1. User sends POST /stellar/init_escrow { session_id, user, provider, amount }
2. Backend calls stellar/scripts/init_escrow.ts
3. Soroban contract calls token.transfer(user, contract_address, amount) — USDC locked
4. Session ID registered on-chain in Pending state
5. Session starts
```

**Key difference:** Stellar escrow locks funds upfront (like `DeploymentEscrow.deposit()`),
whereas x402 uses a signed EIP-3009 authorization that the provider pulls at job start.
Both achieve the same economic guarantee: provider only works if payment is secured.

---

## End-to-End Stellar Flow

```
USER                    BACKEND (Go)                  SOROBAN CONTRACT
 │                          │                               │
 │── POST /sessions ────────▶                               │
 │   (Stellar mode)          │                               │
 │                          │── init_escrow.ts ────────────▶│
 │                          │   user=U, provider=P          │ lock USDC
 │                          │   amount=10000                │ status=Pending
 │                          │◀─ tx_hash ────────────────────│
 │                          │                               │
 │                          │  [agent runs deployment]      │
 │                          │                               │
 │                          │── submit_proof.ts ───────────▶│
 │                          │   merkle_root=0x...           │ store Proof
 │                          │   ipfs_cid=Qm...              │
 │                          │◀─ tx_hash ────────────────────│
 │                          │                               │
 │                          │── release_payment.ts ────────▶│
 │                          │   session_id=...              │ verify proof exists
 │                          │                               │ transfer USDC → provider
 │                          │◀─ tx_hash ────────────────────│ status=Completed
 │                          │                               │
 │◀─ session completed ──────│                               │
```

---

## File Structure

```
stellar/
├── contracts/
│   └── deployment_contract.rs   # Soroban smart contract (Rust)
├── scripts/
│   ├── init_escrow.ts           # Lock funds in escrow (replaces x402)
│   ├── submit_proof.ts          # Submit Merkle root proof (replaces EAS attest)
│   └── release_payment.ts      # Verify proof + release funds (replaces EAS-gated release)
├── types/
│   └── index.ts                 # Shared TypeScript types
├── config/
│   └── stellar.ts               # Network config, contract addresses, env vars
└── docs/
    └── architecture.md          # This file
```

---

## Integration Points in Existing Backend

### 1. `backend/internal/api/handlers.go` — `submitAttestation()`

After `chain.ComputeMerkleRoot(hashes)` succeeds, add a parallel Stellar proof submission:

```go
// STELLAR INTEGRATION POINT
// After Ethereum EAS attestation, also submit to Stellar:
//
//   go func() {
//       cmd := exec.CommandContext(ctx,
//           "npx", "ts-node", "stellar/scripts/submit_proof.ts",
//           "--session_id=" + sessionID,
//           "--merkle_root=" + fmt.Sprintf("0x%x", merkleRoot),
//           "--container_state_hash=" + fmt.Sprintf("0x%x", containerStateHash),
//           "--ipfs_cid=" + ipfsCID,
//       )
//       if out, err := cmd.CombinedOutput(); err != nil {
//           log.Printf("[stellar] proof submission failed: %v\n%s", err, out)
//       }
//   }()
```

### 2. `backend/internal/api/x402.go` — `x402Middleware()`

At the top of the payment validation block, note the future migration path:

```go
// STELLAR INTEGRATION POINT
// Future: Replace x402 X-PAYMENT header validation with a Stellar escrow check.
// When STELLAR_MODE=true:
//   1. Verify X-STELLAR-SESSION header contains a valid session_id
//   2. Call stellar/scripts/init_escrow.ts to lock USDC in Soroban contract
//   3. Skip USDC EIP-3009 transferWithAuthorization
// The DeploymentSession on Stellar serves the same role as the x402 payment receipt.
```

### 3. `backend/internal/chain/eas.go` — `SubmitAttestation()`

At the return of `SubmitAttestation`, parallel Stellar submission can be initiated:

```go
// STELLAR INTEGRATION POINT
// Parallel Stellar proof submission can be triggered here after the EAS tx succeeds.
// Both attestation systems can run concurrently; either can serve as the canonical
// source of truth depending on which chain the user's deployment is priced in.
//
//   go stellarClient.SubmitProof(sessionID, actionMerkleRoot, containerStateHash, ipfsCID)
```

---

## Environment Variables Required

Add to `.env` (alongside existing Ethereum variables):

```env
# Stellar / Soroban
STELLAR_NETWORK=testnet
STELLAR_CONTRACT_ID=C...              # deployed deployment_contract address
STELLAR_USDC_CONTRACT=C...            # USDC token contract on Stellar testnet
STELLAR_PROVIDER_SECRET_KEY=S...      # provider's Stellar keypair secret (never commit)
```

---

## Deployment Steps (Contract)

```bash
# 1. Install Stellar CLI
cargo install --locked stellar-cli --features opt

# 2. Configure testnet identity
stellar keys generate --global comput3-provider --network testnet

# 3. Fund account (testnet friendbot)
stellar keys fund comput3-provider --network testnet

# 4. Build contract
cd stellar/contracts
cargo build --target wasm32-unknown-unknown --release

# 5. Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/deployment_contract.wasm \
  --source comput3-provider \
  --network testnet

# 6. Copy contract ID into stellar/config/stellar.ts and .env
```

---

## Why Stellar + Soroban?

| Attribute | Ethereum (Base Sepolia) | Stellar (Testnet) |
|-----------|------------------------|-------------------|
| Finality | ~2 s (optimistic rollup) | ~5 s (consensus) |
| Fee per tx | ~$0.001 (L2) | ~$0.00001 (native) |
| USDC support | ERC-20 on Base | Native asset / Soroban token |
| Contract language | Solidity | Rust (Soroban) |
| Attestation infra | EAS (mature) | Custom Soroban storage |
| x402 support | Native (HTTP 402) | Via Soroban escrow |
| Ecosystem | Larger DeFi | Payments-focused |

COMPUT3 supports both to give providers and users flexibility:
- Ethereum providers get **EAS attestations** verifiable on BaseScan
- Stellar providers get **Soroban proof records** verifiable on StellarChain
- Both share the same session ID, Merkle root, and IPFS action log
