/**
 * stellar/scripts/submit_proof.ts
 *
 * Submits the deployment proof (Merkle root of agent action hashes) to the
 * Soroban deployment contract.
 *
 * Stellar equivalent of:
 *   - chain.SubmitAttestation() in backend/internal/chain/eas.go
 *   - EAS.attest() on Ethereum
 *
 * INTEGRATION POINT (backend):
 *   Call this immediately after ComputeMerkleRoot() in
 *   backend/internal/api/handlers.go → submitAttestation().
 *
 *   The Ethereum EAS submission and this Stellar proof submission can run
 *   concurrently (both are fire-and-forget goroutines / async calls).
 *
 *   In Go:
 *     go stellarClient.SubmitProof(sessionID, merkleRootHex, ipfsCID)
 *
 * Usage:
 *   npx ts-node stellar/scripts/submit_proof.ts \
 *     --session_id           <UUID> \
 *     --merkle_root          <0xHEX_32_BYTES> \
 *     --container_state_hash <0xHEX_32_BYTES> \
 *     --ipfs_cid             <CID>
 */

import {
  Contract,
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ACTIVE_NETWORK,
  BASE_FEE,
  DEPLOYMENT_CONTRACT_ID,
  PROVIDER_SECRET_KEY,
} from "../config/stellar";
import type { ContractResult, SubmitProofParams } from "../types";

/**
 * Records the deployment Merkle root on Stellar as a proof attestation.
 * Analogous to EAS.attest() but stored in Soroban contract storage.
 */
export async function submitProof(params: SubmitProofParams): Promise<ContractResult> {
  console.log("[stellar/submit_proof] Submitting proof for session:", params.session_id);
  console.log("[stellar/submit_proof] Merkle root:          ", params.merkle_root);
  console.log("[stellar/submit_proof] Container state hash: ", params.container_state_hash);
  console.log("[stellar/submit_proof] IPFS CID:             ", params.ipfs_cid);

  // ------------------------------------------------------------------
  // TODO: Replace simulation block with real Soroban invocation once
  //       the contract is deployed and STELLAR_PROVIDER_SECRET_KEY is set.
  // ------------------------------------------------------------------
  if (!PROVIDER_SECRET_KEY) {
    console.warn("[stellar/submit_proof] STELLAR_PROVIDER_SECRET_KEY not set — returning simulated result");
    return simulateResult(params.session_id);
  }

  try {
    const server = new SorobanRpc.Server(ACTIVE_NETWORK.rpcUrl, { allowHttp: false });
    const keypair = Keypair.fromSecret(PROVIDER_SECRET_KEY);
    const account = await server.getAccount(keypair.publicKey());

    const contract = new Contract(DEPLOYMENT_CONTRACT_ID);

    // Convert hex strings (0x-prefixed, 32 bytes) → BytesN<32> ScVal
    const toBytes32ScVal = (hex: string): xdr.ScVal => {
      const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
      const buf = Buffer.from(clean.padStart(64, "0"), "hex");
      return xdr.ScVal.scvBytes(buf);
    };

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE.toString(),
      networkPassphrase: ACTIVE_NETWORK.passphrase,
    })
      .addOperation(
        contract.call(
          "submit_proof",
          // provider (signer = provider)
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeAccount(
              xdr.AccountID.publicKeyTypeEd25519(keypair.rawPublicKey())
            )
          ),
          // session_id
          xdr.ScVal.scvBytes(Buffer.from(params.session_id, "utf-8")),
          // merkle_root (BytesN<32>)
          toBytes32ScVal(params.merkle_root),
          // container_state_hash (BytesN<32>)
          toBytes32ScVal(params.container_state_hash),
          // ipfs_cid (Bytes)
          xdr.ScVal.scvBytes(Buffer.from(params.ipfs_cid, "utf-8"))
        )
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(keypair);
    const response = await server.sendTransaction(preparedTx);

    if (response.status === "ERROR") {
      throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
    }

    console.log("[stellar/submit_proof] Transaction submitted:", response.hash);
    console.log("[stellar/submit_proof] Explorer:", `${ACTIVE_NETWORK.explorerUrl}/${response.hash}`);

    return {
      tx_hash: response.hash,
      ledger: 0,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stellar/submit_proof] Error:", message);
    return { tx_hash: "", ledger: 0, success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Simulation helper
// ---------------------------------------------------------------------------

function simulateResult(sessionId: string): ContractResult {
  const fakeTxHash =
    "SIMULATED_PROOF_" +
    Buffer.from(sessionId).toString("hex").slice(0, 16).toUpperCase();
  console.log(`[stellar/submit_proof] SIMULATED tx_hash: ${fakeTxHash}`);
  return { tx_hash: fakeTxHash, ledger: 0, success: true };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, ...rest] = a.slice(2).split("=");
        return [k, rest.join("=")];
      })
  );

  const params: SubmitProofParams = {
    provider: args.provider ?? "",
    session_id: args.session_id ?? "",
    merkle_root: args.merkle_root ?? "0x" + "00".repeat(32),
    container_state_hash: args.container_state_hash ?? "0x" + "00".repeat(32),
    ipfs_cid: args.ipfs_cid ?? "",
  };

  if (!params.session_id) {
    console.error(
      "Usage: ts-node submit_proof.ts --session_id=<id> --merkle_root=<0xhex> [--container_state_hash=<0xhex>] [--ipfs_cid=<cid>]"
    );
    process.exit(1);
  }

  submitProof(params)
    .then((result) => {
      console.log("[stellar/submit_proof] Result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
