/**
 * COMPUT3 — Stellar integration type definitions
 *
 * Mirrors the data shapes used by the Soroban deployment_contract.rs.
 * Import these wherever you interact with the Stellar layer.
 */

// ---------------------------------------------------------------------------
// Payment state — mirrors PaymentStatus enum in the Soroban contract
// ---------------------------------------------------------------------------

export type PaymentStatus = "Pending" | "Completed" | "Refunded";

// ---------------------------------------------------------------------------
// DeploymentSession
//
// Mirrors DeploymentSession struct in the Soroban contract.
// Also maps onto the existing backend `store.Session` shape so the same
// session ID can be used across both the Ethereum and Stellar layers.
// ---------------------------------------------------------------------------

export interface DeploymentSession {
  /** UUID that matches backend session ID (e.g. "550e8400-e29b-41d4-a716-446655440000") */
  session_id: string;
  /** Stellar address of the user who initiated the deployment */
  user: string;
  /** Stellar address of the selected provider */
  provider: string;
  /** Stellar address of the payment token (e.g. USDC issuer on testnet) */
  token: string;
  /** Escrowed amount in token's smallest unit */
  amount: bigint;
  /** Current payment lifecycle state */
  status: PaymentStatus;
  /** Stellar ledger sequence number at creation (used for refund timeout) */
  created_at_ledger: number;
}

// ---------------------------------------------------------------------------
// Proof
//
// On-chain proof record — Stellar equivalent of an EAS attestation.
// Submitted by the provider after computing the Merkle root of all
// agent action hashes.
// ---------------------------------------------------------------------------

export interface Proof {
  /**
   * SHA-256 / Keccak256 Merkle root of all agent action hashes.
   * Matches actionMerkleRoot submitted to EAS on Ethereum.
   * Hex-encoded, 0x-prefixed, 32 bytes.
   */
  merkle_root: string;
  /**
   * Hash of the final container state.
   * Hex-encoded, 0x-prefixed, 32 bytes.
   */
  container_state_hash: string;
  /** IPFS CID of the full action log (UTF-8 string) */
  ipfs_cid: string;
  /** Stellar ledger sequence number when proof was submitted */
  submitted_at_ledger: number;
}

// ---------------------------------------------------------------------------
// PaymentState
//
// Aggregated view combining DeploymentSession + Proof for frontend/API use.
// ---------------------------------------------------------------------------

export interface PaymentState {
  session: DeploymentSession;
  proof: Proof | null;
  /** True when proof has been submitted and payment released */
  is_released: boolean;
}

// ---------------------------------------------------------------------------
// Contract invocation parameter shapes
// ---------------------------------------------------------------------------

export interface InitDeploymentParams {
  user: string;
  provider: string;
  token: string;
  amount: bigint;
  session_id: string;
}

export interface SubmitProofParams {
  provider: string;
  session_id: string;
  /** 0x-prefixed 32-byte hex */
  merkle_root: string;
  /** 0x-prefixed 32-byte hex */
  container_state_hash: string;
  ipfs_cid: string;
}

export interface VerifyAndReleaseParams {
  session_id: string;
}

export interface RefundParams {
  user: string;
  session_id: string;
}

// ---------------------------------------------------------------------------
// Contract invocation result
// ---------------------------------------------------------------------------

export interface ContractResult {
  /** Stellar transaction hash */
  tx_hash: string;
  /** Ledger sequence the transaction was included in */
  ledger: number;
  success: boolean;
  error?: string;
}
