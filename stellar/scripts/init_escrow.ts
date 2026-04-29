/**
 * stellar/scripts/init_escrow.ts
 *
 * Initialises a Stellar escrow for a COMPUT3 deployment session.
 *
 * Stellar equivalent of:
 *   - x402 payment verification  (X-PAYMENT header on /sessions route)
 *   - DeploymentEscrow.deposit() on Ethereum
 *
 * INTEGRATION POINT (backend):
 *   Call this script (or equivalent SDK code) from the Go backend when a
 *   new session is created and Stellar payment mode is selected.
 *
 *   In Go, invoke via exec.Command("npx", "ts-node", "stellar/scripts/init_escrow.ts", ...)
 *   or wrap in a thin Go HTTP sidecar that exposes a POST /stellar/init_escrow endpoint.
 *
 * Usage:
 *   npx ts-node stellar/scripts/init_escrow.ts \
 *     --session_id <UUID> \
 *     --user       <STELLAR_ADDRESS> \
 *     --provider   <STELLAR_ADDRESS> \
 *     --amount     <MICRO_USDC>
 */

import {
  Contract,
  Keypair,
  Networks,
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
  STELLAR_NETWORK,
  USDC_ASSET_CONTRACT,
} from "../config/stellar";
import type { ContractResult, InitDeploymentParams } from "../types";

/**
 * Locks `amount` USDC in the Soroban deployment contract on behalf of `user`.
 *
 * In production this would be called with a real Soroban RPC server.
 * For MVP / hackathon the function logs the intended call and returns a
 * simulated result so the rest of the backend can be tested end-to-end
 * without a live Stellar node.
 */
export async function initEscrow(
  params: InitDeploymentParams
): Promise<ContractResult> {
  console.log("[stellar/init_escrow] Initialising escrow for session:", params.session_id);
  console.log("[stellar/init_escrow] User:    ", params.user);
  console.log("[stellar/init_escrow] Provider:", params.provider);
  console.log("[stellar/init_escrow] Amount:  ", params.amount.toString(), "micro-USDC");

  // ------------------------------------------------------------------
  // TODO: Replace simulation block with real Soroban invocation once
  //       the contract is deployed and STELLAR_PROVIDER_SECRET_KEY is set.
  // ------------------------------------------------------------------
  if (!PROVIDER_SECRET_KEY) {
    console.warn("[stellar/init_escrow] STELLAR_PROVIDER_SECRET_KEY not set — returning simulated result");
    return simulateResult("init_deployment", params.session_id);
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
          "init_deployment",
          // user
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeAccount(
              xdr.AccountID.publicKeyTypeEd25519(
                Keypair.fromPublicKey(params.user).rawPublicKey()
              )
            )
          ),
          // provider
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeAccount(
              xdr.AccountID.publicKeyTypeEd25519(
                Keypair.fromPublicKey(params.provider).rawPublicKey()
              )
            )
          ),
          // token (USDC contract)
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeContract(
              Buffer.from(USDC_ASSET_CONTRACT, "hex")
            )
          ),
          // amount
          nativeToScVal(params.amount, { type: "i128" }),
          // session_id (as Bytes)
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

    console.log("[stellar/init_escrow] Transaction submitted:", response.hash);
    return {
      tx_hash: response.hash,
      ledger: 0, // filled after polling
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stellar/init_escrow] Error:", message);
    return { tx_hash: "", ledger: 0, success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Simulation helper — used when no key is configured
// ---------------------------------------------------------------------------

function simulateResult(operation: string, sessionId: string): ContractResult {
  const fakeTxHash =
    "SIMULATED_" +
    operation.toUpperCase() +
    "_" +
    Buffer.from(sessionId).toString("hex").slice(0, 16).toUpperCase();
  console.log(`[stellar/init_escrow] SIMULATED tx_hash: ${fakeTxHash}`);
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
        const [k, v] = a.slice(2).split("=");
        return [k, v ?? ""];
      })
  );

  const params: InitDeploymentParams = {
    user: args.user ?? "",
    provider: args.provider ?? "",
    token: USDC_ASSET_CONTRACT,
    amount: BigInt(args.amount ?? "10000"),
    session_id: args.session_id ?? "",
  };

  if (!params.session_id || !params.user || !params.provider) {
    console.error("Usage: ts-node init_escrow.ts --session_id=<id> --user=<addr> --provider=<addr> [--amount=<micro_usdc>]");
    process.exit(1);
  }

  initEscrow(params)
    .then((result) => {
      console.log("[stellar/init_escrow] Result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
