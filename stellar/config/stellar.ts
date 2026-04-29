/**
 * stellar/config/stellar.ts
 *
 * Stellar + Soroban network configuration for COMPUT3.
 * Single source of truth — import from here in all scripts.
 */

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export type StellarNetwork = "testnet" | "mainnet";

export const STELLAR_NETWORK: StellarNetwork = "testnet";

/** Stellar Testnet Horizon + Soroban RPC endpoints */
export const NETWORK_CONFIG = {
  testnet: {
    /** Horizon REST API — used for classic operations and account lookups */
    horizonUrl: "https://horizon-testnet.stellar.org",
    /** Soroban RPC — used for contract invocations */
    rpcUrl: "https://soroban-testnet.stellar.org",
    /** Network passphrase required for transaction signing */
    passphrase: "Test SDF Network ; September 2015",
    /** Stellar Testnet Explorer base URL */
    explorerUrl: "https://stellarchain.io/transactions",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    explorerUrl: "https://stellarchain.io/transactions",
  },
} as const;

export const ACTIVE_NETWORK = NETWORK_CONFIG[STELLAR_NETWORK];

// ---------------------------------------------------------------------------
// Contract addresses (placeholders — replace after deployment)
// ---------------------------------------------------------------------------

/**
 * Deployed Soroban contract address for deployment_contract.rs.
 *
 * Replace with real address after running:
 *   stellar contract deploy \
 *     --wasm target/wasm32-unknown-unknown/release/deployment_contract.wasm \
 *     --source <DEPLOYER_SECRET_KEY> \
 *     --network testnet
 */
export const DEPLOYMENT_CONTRACT_ID =
  process.env.STELLAR_CONTRACT_ID ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"; // placeholder C-address

// ---------------------------------------------------------------------------
// USDC token on Stellar Testnet
//
// The "official" Circle USDC test-anchor address.
// Replace with the real issuer once Circle publishes it for Stellar testnet.
// ---------------------------------------------------------------------------
export const USDC_ASSET_CONTRACT =
  process.env.STELLAR_USDC_CONTRACT ?? "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"; // placeholder

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Provider Stellar secret key — signs proof submission and release transactions.
 * NEVER commit a real key; load from environment only.
 */
export const PROVIDER_SECRET_KEY = process.env.STELLAR_PROVIDER_SECRET_KEY ?? "";

/**
 * Fee budget per operation (in stroops; 1 XLM = 10_000_000 stroops).
 * 100 stroops = 0.00001 XLM — sufficient for testnet.
 */
export const BASE_FEE = 100;

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/**
 * Number of ledgers after which users may claim a refund (~24h at 5s/ledger).
 * Must match REFUND_TIMEOUT_LEDGERS in deployment_contract.rs.
 */
export const REFUND_TIMEOUT_LEDGERS = 17_280;
