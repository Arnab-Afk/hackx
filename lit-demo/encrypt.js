/**
 * encrypt.js — Encrypts container secrets with Lit Protocol.
 * Access condition: wallet must have ETH balance on Base Sepolia (demo mode).
 * Swap to EAS condition once you have an attestation UID.
 * Run: node encrypt.js  →  outputs encrypted.json
 */

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork, LitAbility } from "@lit-protocol/constants";
import { LitAccessControlConditionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const EAS_CONTRACT  = "0x4200000000000000000000000000000000000021"; // EAS on Base Sepolia
const EAS_SCHEMA_UID = process.env.EAS_SCHEMA_UID;

const SECRETS = {
  DATABASE_URL:       process.env.SECRET_DB_URL,
  PORT:               process.env.SECRET_PORT,
  ANTHROPIC_API_KEY:  process.env.SECRET_ANTHROPIC_API_KEY,
};

// ── Access condition ──────────────────────────────────────────────────────────
// MODE A (demo — works immediately): wallet balance > 0 on Base Sepolia
// MODE B (production): EAS attestation must be valid  ← uncomment when you have a UID
function buildAccessConditions(walletAddress) {
  // MODE A — balance check (runs now)
  return [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "baseSepolia",
      method: "eth_getBalance",
      parameters: [walletAddress, "latest"],
      returnValueTest: { comparator: ">", value: "0" },
    },
  ];

  // MODE B — EAS attestation check (uncomment + set ATTESTATION_UID in .env)
  // return [{
  //   contractAddress: EAS_CONTRACT,
  //   functionName: "isAttestationValid",
  //   functionParams: [process.env.ATTESTATION_UID],
  //   functionAbi: {
  //     name: "isAttestationValid", type: "function", stateMutability: "view",
  //     inputs: [{ name: "uid", type: "bytes32" }],
  //     outputs: [{ name: "", type: "bool" }],
  //   },
  //   chain: "baseSepolia",
  //   returnValueTest: { key: "", comparator: "=", value: "true" },
  // }];
}

async function main() {
  if (!process.env.PRIVATE_KEY) { console.error("Set PRIVATE_KEY in .env"); process.exit(1); }

  console.log("Connecting to Lit Protocol (datil-dev)...");
  const client = new LitJsSdk.LitNodeClientNodeJs({
    alertWhenUnauthorized: false,
    litNetwork: LitNetwork.DatilTest,
    debug: false,
  });
  await client.connect();
  console.log("Connected to Lit.");

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`Wallet: ${wallet.address}`);

  const sessionSigs = await client.getSessionSigs({
    chain: "baseSepolia",
    expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    resourceAbilityRequests: [{
      resource: new LitAccessControlConditionResource("*"),
      ability: LitAbility.AccessControlConditionEncryption,
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

  const accessControlConditions = buildAccessConditions(wallet.address);
  const secretsJson = JSON.stringify(SECRETS);

  console.log("Encrypting secrets...");
  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
    { accessControlConditions, dataToEncrypt: secretsJson },
    client
  );

  const output = { ciphertext, dataToEncryptHash, accessControlConditions, encryptedAt: new Date().toISOString() };
  fs.writeFileSync("encrypted.json", JSON.stringify(output, null, 2));

  console.log("\nDone! → encrypted.json");
  console.log("Safe to commit. Decryption requires wallet with ETH on Base Sepolia.");
  console.log(`EAS Schema: ${EAS_SCHEMA_UID} (swap to MODE B once attestation UID is known)`);

  await client.disconnect();
}

main().catch(console.error);
