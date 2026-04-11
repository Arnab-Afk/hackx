/**
 * decrypt.js — Container startup script.
 * Calls Lit Protocol, checks access condition (EAS/balance), decrypts secrets.
 * Exit 1 → container never starts.
 */

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork, LitAbility } from "@lit-protocol/constants";
import { LitAccessControlConditionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error("[startup] PRIVATE_KEY not set"); process.exit(1);
  }
  if (!fs.existsSync("encrypted.json")) {
    console.error("[startup] encrypted.json not found — run encrypt.js first"); process.exit(1);
  }

  const { ciphertext, dataToEncryptHash, accessControlConditions } =
    JSON.parse(fs.readFileSync("encrypted.json", "utf8"));

  console.log("[startup] Connecting to Lit Protocol...");
  const client = new LitJsSdk.LitNodeClientNodeJs({
    alertWhenUnauthorized: false,
    litNetwork: LitNetwork.DatilTest,
    debug: false,
  });
  await client.connect();

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`[startup] Wallet: ${wallet.address}`);
  console.log("[startup] Verifying access condition on Base Sepolia...");

  let sessionSigs;
  try {
    sessionSigs = await client.getSessionSigs({
      chain: "baseSepolia",
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      resourceAbilityRequests: [{
        resource: new LitAccessControlConditionResource("*"),
        ability: LitAbility.AccessControlConditionDecryption,
      }],
      authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
        const toSign = await createSiweMessageWithRecaps({
          uri, expiration, resources: resourceAbilityRequests,
          walletAddress: wallet.address,
          nonce: await client.getLatestBlockhash(),
          litNodeClient: client,
        });
        return await generateAuthSig({ signer: wallet, toSign });
      },
    });
  } catch (err) {
    console.error("[startup] Auth failed:", err.message);
    await client.disconnect(); process.exit(1);
  }

  let decryptedString;
  try {
    decryptedString = await LitJsSdk.decryptToString(
      { accessControlConditions, ciphertext, dataToEncryptHash, chain: "baseSepolia", sessionSigs },
      client
    );
  } catch (err) {
    console.error("[startup] DECRYPTION FAILED — condition not met. Container will NOT start.");
    await client.disconnect(); process.exit(1);
  }

  await client.disconnect();

  const secrets = JSON.parse(decryptedString);
  const envLines = Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join("\n");
  fs.writeFileSync(".env.runtime", envLines);

  console.log("\n[startup] Access condition MET. Secrets unlocked:");
  Object.entries(secrets).forEach(([k, v]) => {
    const masked = v ? v.slice(0, 6) + "****" : "";
    console.log(`  ${k} = ${masked}`);
  });
  console.log("\n[startup] Container cleared to start.");
}

main().catch((err) => {
  console.error("[startup] Fatal:", err.message);
  process.exit(1);
});
