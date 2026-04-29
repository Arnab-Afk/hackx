//! COMPUT3 — Stellar Soroban Deployment Contract
//!
//! Parallel trust + payment layer that mirrors the existing EAS + x402 system.
//!
//! EAS  → proof storage  (submit_proof / verify_and_release)
//! x402 → escrow logic   (init_deployment / refund)
//!
//! Lifecycle:
//!   1. Agent calls init_deployment()  → funds locked in contract
//!   2. Agent calls submit_proof()     → Merkle root recorded on-chain
//!   3. Agent calls verify_and_release() → payment released to provider
//!   4. User calls refund()            → funds returned if deployment never completed

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, String,
    token::Client as TokenClient,
};

// ---------------------------------------------------------------------------
// Storage key types
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    /// Deployment session keyed by session_id string
    Session(Bytes),
    /// Proof record keyed by session_id string
    Proof(Bytes),
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/// Mirrors EscrowStatus in DeploymentEscrow.sol
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Completed,
    Refunded,
}

/// Core deployment record — analogous to EAS attestation data + Escrow struct combined.
#[contracttype]
#[derive(Clone, Debug)]
pub struct DeploymentSession {
    /// Unique deployment session identifier (matches backend session UUID)
    pub session_id: Bytes,
    /// User's Stellar address (the one who initiated the deployment)
    pub user: Address,
    /// Provider's Stellar address (the one who performs the deployment)
    pub provider: Address,
    /// Payment token (e.g. USDC on Stellar)
    pub token: Address,
    /// Escrowed amount in token's smallest unit (e.g. stroops for XLM, micro-USDC for USDC)
    pub amount: i128,
    /// Current payment state
    pub status: PaymentStatus,
    /// Ledger sequence number when session was created (used for refund timeout)
    pub created_at_ledger: u32,
}

/// On-chain proof record — analogous to an EAS attestation.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proof {
    /// SHA-256 Merkle root of all agent action hashes
    /// (matches the actionMerkleRoot submitted to EAS on Ethereum)
    pub merkle_root: BytesN<32>,
    /// Keccak256 / SHA-256 hash of final container state
    pub container_state_hash: BytesN<32>,
    /// IPFS CID of the full action log (UTF-8 encoded bytes)
    pub ipfs_cid: Bytes,
    /// Ledger sequence number when proof was submitted
    pub submitted_at_ledger: u32,
}

// ---------------------------------------------------------------------------
// Contract configuration constants
// ---------------------------------------------------------------------------

/// Number of ledgers after which a user may request a refund (~24 hours at 5s/ledger)
const REFUND_TIMEOUT_LEDGERS: u32 = 17_280;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct DeploymentContract;

#[contractimpl]
impl DeploymentContract {
    // -----------------------------------------------------------------------
    // 1. init_deployment
    //    Equivalent to: x402 payment verification + DeploymentEscrow.deposit()
    //
    //    The agent frontend calls this before any provisioning work begins.
    //    Funds are transferred from `user` into this contract and held in escrow.
    // -----------------------------------------------------------------------
    pub fn init_deployment(
        env: Env,
        user: Address,
        provider: Address,
        token: Address,
        amount: i128,
        session_id: Bytes,
    ) {
        // Require that the caller is the user (prevents front-running)
        user.require_auth();

        // Reject duplicate session IDs
        let key = DataKey::Session(session_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("session already exists");
        }

        // Transfer tokens from user → this contract (escrow)
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Persist session record
        let session = DeploymentSession {
            session_id: session_id.clone(),
            user,
            provider,
            token,
            amount,
            status: PaymentStatus::Pending,
            created_at_ledger: env.ledger().sequence(),
        };
        env.storage().persistent().set(&key, &session);

        // Emit event for indexers / backend to pick up
        env.events().publish(
            (String::from_str(&env, "deployment"), String::from_str(&env, "init")),
            session_id,
        );
    }

    // -----------------------------------------------------------------------
    // 2. submit_proof
    //    Equivalent to: EAS.attest() on Ethereum
    //
    //    The provider backend calls this after completing the deployment and
    //    computing the Merkle root of all agent action hashes.
    // -----------------------------------------------------------------------
    pub fn submit_proof(
        env: Env,
        provider: Address,
        session_id: Bytes,
        merkle_root: BytesN<32>,
        container_state_hash: BytesN<32>,
        ipfs_cid: Bytes,
    ) {
        // Only the registered provider for this session may submit proof
        provider.require_auth();

        let session_key = DataKey::Session(session_id.clone());
        let session: DeploymentSession = env
            .storage()
            .persistent()
            .get(&session_key)
            .expect("session not found");

        if session.provider != provider {
            panic!("caller is not the registered provider for this session");
        }
        if session.status != PaymentStatus::Pending {
            panic!("session is not in Pending state");
        }

        // Prevent duplicate proof submissions
        let proof_key = DataKey::Proof(session_id.clone());
        if env.storage().persistent().has(&proof_key) {
            panic!("proof already submitted");
        }

        // Store proof — this is the Stellar equivalent of an EAS attestation UID
        let proof = Proof {
            merkle_root: merkle_root.clone(),
            container_state_hash,
            ipfs_cid,
            submitted_at_ledger: env.ledger().sequence(),
        };
        env.storage().persistent().set(&proof_key, &proof);

        // Emit event
        env.events().publish(
            (String::from_str(&env, "deployment"), String::from_str(&env, "proof_submitted")),
            (session_id, merkle_root),
        );
    }

    // -----------------------------------------------------------------------
    // 3. verify_and_release
    //    Equivalent to: DeploymentEscrow.release() on Ethereum
    //
    //    Anyone may call this — the contract verifies proof exists, then
    //    releases escrowed funds to the provider. Idempotent once completed.
    // -----------------------------------------------------------------------
    pub fn verify_and_release(env: Env, session_id: Bytes) {
        let session_key = DataKey::Session(session_id.clone());
        let mut session: DeploymentSession = env
            .storage()
            .persistent()
            .get(&session_key)
            .expect("session not found");

        if session.status != PaymentStatus::Pending {
            panic!("session is not in Pending state");
        }

        // Verify proof exists (acts as attestation validity check)
        let proof_key = DataKey::Proof(session_id.clone());
        if !env.storage().persistent().has(&proof_key) {
            panic!("no proof submitted — cannot release payment");
        }

        // Release escrowed funds to provider
        let token_client = TokenClient::new(&env, &session.token);
        token_client.transfer(
            &env.current_contract_address(),
            &session.provider,
            &session.amount,
        );

        // Update session status
        session.status = PaymentStatus::Completed;
        env.storage().persistent().set(&session_key, &session);

        env.events().publish(
            (String::from_str(&env, "deployment"), String::from_str(&env, "payment_released")),
            session_id,
        );
    }

    // -----------------------------------------------------------------------
    // 4. refund
    //    Equivalent to: DeploymentEscrow.refund() on Ethereum
    //
    //    User may reclaim funds if:
    //      a) No proof has been submitted, AND
    //      b) REFUND_TIMEOUT_LEDGERS have elapsed since session creation
    // -----------------------------------------------------------------------
    pub fn refund(env: Env, user: Address, session_id: Bytes) {
        user.require_auth();

        let session_key = DataKey::Session(session_id.clone());
        let mut session: DeploymentSession = env
            .storage()
            .persistent()
            .get(&session_key)
            .expect("session not found");

        if session.user != user {
            panic!("caller is not the session owner");
        }
        if session.status != PaymentStatus::Pending {
            panic!("session is not in Pending state");
        }

        // Proof must not have been submitted
        let proof_key = DataKey::Proof(session_id.clone());
        if env.storage().persistent().has(&proof_key) {
            panic!("proof already submitted — cannot refund");
        }

        // Enforce timeout
        let current_ledger = env.ledger().sequence();
        if current_ledger < session.created_at_ledger + REFUND_TIMEOUT_LEDGERS {
            panic!("refund timeout has not elapsed yet");
        }

        // Return funds to user
        let token_client = TokenClient::new(&env, &session.token);
        token_client.transfer(
            &env.current_contract_address(),
            &session.user,
            &session.amount,
        );

        // Update session status
        session.status = PaymentStatus::Refunded;
        env.storage().persistent().set(&session_key, &session);

        env.events().publish(
            (String::from_str(&env, "deployment"), String::from_str(&env, "refunded")),
            session_id,
        );
    }

    // -----------------------------------------------------------------------
    // Read-only helpers
    // -----------------------------------------------------------------------

    /// Returns the full deployment session record.
    pub fn get_session(env: Env, session_id: Bytes) -> Option<DeploymentSession> {
        env.storage()
            .persistent()
            .get(&DataKey::Session(session_id))
    }

    /// Returns the submitted proof for a session (analogous to looking up an EAS UID).
    pub fn get_proof(env: Env, session_id: Bytes) -> Option<Proof> {
        env.storage()
            .persistent()
            .get(&DataKey::Proof(session_id))
    }

    /// Returns true if a valid proof has been submitted for the session.
    /// Drop-in equivalent of EAS.isAttestationValid(uid).
    pub fn is_proof_valid(env: Env, session_id: Bytes) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Proof(session_id))
    }
}
