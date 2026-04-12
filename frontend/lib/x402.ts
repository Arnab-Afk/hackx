/**
 * x402 client helpers.
 *
 * Flow:
 *   1. Call API → 402 → parse x402PaymentRequired body
 *   2. buildTransferTypedData() → get EIP-712 typed data to sign
 *   3. User signs via wagmi useSignTypedData
 *   4. makePaymentHeader(signature, typedData) → base64 JSON for X-PAYMENT header
 *   5. Retry original request with X-PAYMENT header
 */

// ── types returned by the backend 402 body ───────────────────────────────────

export interface X402Accepts {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;                       // USDC contract address
  extra?: { name?: string; version?: string };
}

export interface X402PaymentRequired {
  x402Version: number;
  error: string;
  accepts: X402Accepts[];
}

// ── EIP-712 domain & types for USDC transferWithAuthorization ────────────────

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export interface TransferTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    TransferWithAuthorization: Array<{ name: string; type: string }>;
  };
  primaryType: "TransferWithAuthorization";
  message: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
  };
}

/** Generate a random 32-byte nonce as 0x-prefixed hex. */
function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * Build the EIP-712 typed data required to sign a USDC transferWithAuthorization.
 *
 * @param accepts  - the first entry from the 402 body's `accepts` array
 * @param from     - the user's wallet address (payer)
 */
export function buildTransferTypedData(
  accepts: X402Accepts,
  from: `0x${string}`
): TransferTypedData {
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + accepts.maxTimeoutSeconds);

  return {
    domain: {
      name: accepts.extra?.name ?? "USD Coin",
      version: accepts.extra?.version ?? "2",
      chainId: BASE_SEPOLIA_CHAIN_ID,
      verifyingContract: accepts.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from,
      to: accepts.payTo as `0x${string}`,
      value: BigInt(accepts.maxAmountRequired),
      validAfter: 0n,
      validBefore,
      nonce: randomNonce(),
    },
  };
}

/**
 * Split a 65-byte EIP-712 signature into v, r, s and build the base64-encoded
 * X-PAYMENT header string expected by the backend.
 */
export function makePaymentHeader(
  signature: `0x${string}`,
  typedData: TransferTypedData
): string {
  // signature is 0x + 130 hex chars (65 bytes: r[32] s[32] v[1])
  const sig = signature.slice(2); // strip 0x
  const r = "0x" + sig.slice(0, 64);
  const s = "0x" + sig.slice(64, 128);
  const v = parseInt(sig.slice(128, 130), 16);

  const msg = typedData.message;

  const payload = {
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      from: msg.from,
      to: msg.to,
      value: msg.value.toString(),
      validAfter: msg.validAfter.toString(),
      validBefore: msg.validBefore.toString(),
      nonce: msg.nonce,
      v,
      r,
      s,
    },
  };

  return btoa(JSON.stringify(payload));
}
