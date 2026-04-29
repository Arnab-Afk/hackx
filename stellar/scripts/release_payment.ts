/**
 * stellar/scripts/release_payment.ts
 *
 * Verifies that a proof has been submitted and releases escrowed funds
 * to the provider.
 *
 * Stellar equivalent of:
 *   - DeploymentEscrow.release() on Ethereum (triggered by the backend
 *     after a successful deployment)
 *
 * INTEGRATION POINT (backend):
 *   Call this after EAS attestation has been submitted and confirmed, i.e.
 *   at the end of submitAttestation() in
 *   backend/internal/api/handlers.go.
 *
 *   The Ethereum release and this Stellar release run independently;
 *   either may fail without affecting the other.
 *
 * Usage:
 *   npx ts-node stellar/scripts/release_payment.ts --session_id <UUID>
 */

import {
  Contract,
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ACTIVE_NETWORK,
  BASE_FEE,
  DEPLOYMENT_CONTRACT_ID,
  PROVIDER_SECRET_KEY,
} from "../config/stellar";
import type { ContractResult, VerifyAndReleaseParams } from "../types";

/**
 * Calls verify_and_release() on the Soroban contract.
 *
 * The contract checks internally that a proof exists before releasing funds,
 * so this call is safe to make idempotently — it will fail with a contract
 * error if the session is not in Pending state or no proof was submitted.
 */
export async function releasePayment(
  params: VerifyAndReleaseParams
): Promise<ContractResult> {
  console.log("[stellar/release_payment] Releasing payment for session:", params.session_id);

  // ------------------------------------------------------------------
  // TODO: Replace simulation block with real Soroban invocation once
  //       the contract is deployed and STELLAR_PROVIDER_SECRET_KEY is set.
  // ------------------------------------------------------------------
  if (!PROVIDER_SECRET_KEY) {
    console.warn(
      "[stellar/release_payment] STELLAR_PROVIDER_SECRET_KEY not set — returning simulated result"
    );
    return simulateResult(params.session_id);
  }

  try {
    const server = new SorobanRpc.Server(ACTIVE_NETWORK.rpcUrl, { allowHttp: false });
    const keypair = Keypair.fromSecret(PROVIDER_SECRET_KEY);
    const account = await server.getAccount(keypair.publicKey());

    const contract = new Contract(DEPLOYMENT_CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE.toString(),
      networkPassphrase: ACTIVE_NETWORK.passphrase,
    })
      .addOperation(
        contract.call(
          "verify_and_release",
          // session_id
          xdr.ScVal.scvBytes(Buffer.from(params.session_id, "utf-8"))
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

    console.log("[stellar/release_payment] Transaction submitted:", response.hash);
    console.log(
      "[stellar/release_payment] Explorer:",
      `${ACTIVE_NETWORK.explorerUrl}/${response.hash}`
    );

    return { tx_hash: response.hash, ledger: 0, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stellar/release_payment] Error:", message);
    return { tx_hash: "", ledger: 0, success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Read-only helper: check if a session's proof is valid on Stellar
//
// Equivalent of chain.IsAttestationValid() / EAS.isAttestationValid()
// ---------------------------------------------------------------------------

export async function isProofValid(sessionId: string): Promise<boolean> {
  if (!PROVIDER_SECRET_KEY) {
    console.warn("[stellar/release_payment] isProofValid — simulated: true");
    return true;
  }

  try {
    const server = new SorobanRpc.Server(ACTIVE_NETWORK.rpcUrl, { allowHttp: false });
    const keypair = Keypair.fromSecret(PROVIDER_SECRET_KEY);
    const account = await server.getAccount(keypair.publicKey());

    const contract = new Contract(DEPLOYMENT_CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE.toString(),
      networkPassphrase: ACTIVE_NETWORK.passphrase,
    })
      .addOperation(
        contract.call(
          "is_proof_valid",
          xdr.ScVal.scvBytes(Buffer.from(sessionId, "utf-8"))
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationSuccess(simResult)) {
      // ScVal bool
      const val = simResult.result?.retval;
      return val?.switch() === xdr.ScValType.scvBool() && val.b();
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Simulation helper
// ---------------------------------------------------------------------------

function simulateResult(sessionId: string): ContractResult {
  const fakeTxHash =
    "SIMULATED_RELEASE_" +
    Buffer.from(sessionId).toString("hex").slice(0, 16).toUpperCase();
  console.log(`[stellar/release_payment] SIMULATED tx_hash: ${fakeTxHash}`);
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

  const sessionId = args.session_id ?? "";
  if (!sessionId) {
    console.error("Usage: ts-node release_payment.ts --session_id=<id>");
    process.exit(1);
  }

  releasePayment({ session_id: sessionId })
    .then((result) => {
      console.log("[stellar/release_payment] Result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
