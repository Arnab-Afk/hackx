/**
 * register-eas-schema.ts
 *
 * Registers the zkLOUD attestation schema on Ethereum Attestation Service (EAS)
 * deployed on Base Sepolia.
 *
 * Schema fields:
 *   bytes32 teamId            — keccak256 of the team identifier
 *   bytes32 actionMerkleRoot  — Merkle root of all agent action hashes
 *   bytes32 containerStateHash — Hash of the final container state
 *   string  sessionId          — Human-readable session identifier
 *   string  ipfsCid            — IPFS CID of the full action log JSON
 *
 * Run:
 *   npx hardhat run scripts/register-eas-schema.ts --network baseSepolia
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// EAS SchemaRegistry address on Base Sepolia
// Source: https://docs.attest.org/docs/quick--start/contracts
const EAS_SCHEMA_REGISTRY: Record<string, string> = {
  baseSepolia: "0x4200000000000000000000000000000000000020", // EAS predeploy on Base Sepolia
  hardhat:     "0x0000000000000000000000000000000000000000",
};

// Minimal ABI — only the register function we need
const SCHEMA_REGISTRY_ABI = [
  "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
  "event Registered(bytes32 indexed uid, address indexed registerer)",
];

const ZKLOUD_SCHEMA =
  "bytes32 teamId,bytes32 actionMerkleRoot,bytes32 containerStateHash,string sessionId,string ipfsCid";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering EAS schema with:", deployer.address);
  console.log("Network:", network.name);

  const registryAddress = EAS_SCHEMA_REGISTRY[network.name];
  if (!registryAddress || registryAddress === "0x0000000000000000000000000000000000000000") {
    console.warn("EAS SchemaRegistry not configured for network:", network.name);
    console.warn("Skipping schema registration.");
    return;
  }

  const registry = new ethers.Contract(registryAddress, SCHEMA_REGISTRY_ABI, deployer);

  console.log("\nSchema string:", ZKLOUD_SCHEMA);
  console.log("Resolver: none (zero address)");
  console.log("Revocable: true\n");

  const tx = await registry.register(
    ZKLOUD_SCHEMA,
    ethers.ZeroAddress, // no custom resolver
    true,              // revocable
  );

  console.log("Transaction submitted:", tx.hash);
  const receipt = await tx.wait();

  // Parse the Registered event to get the schema UID
  // EAS SchemaRegistry emits: Registered(bytes32 indexed uid, address indexed registerer, SchemaRecord schema)
  // The UID is in topics[1] (first indexed param)
  let schemaUid = "";
  for (const log of receipt.logs) {
    // topic[0] is the event signature keccak256("Registered(bytes32,address,(bytes32,address,bool,string))")
    if (log.topics.length >= 2) {
      schemaUid = log.topics[1];
      break;
    }
  }

  console.log("\n✅ EAS schema registered!");
  console.log("   Schema UID:", schemaUid);
  console.log("   View on EAS Explorer: https://base-sepolia.easscan.org/schema/view/" + schemaUid);

  // ─── Persist schema UID alongside deployment addresses ────────────────────
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  let deployments: Record<string, Record<string, string>> = {};

  if (fs.existsSync(deploymentsPath)) {
    try {
      deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
    } catch { /* ignore */ }
  }

  if (!deployments[network.name]) {
    deployments[network.name] = {};
  }
  deployments[network.name].EASSchemaUID = schemaUid;

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("   Schema UID saved to deployments.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
