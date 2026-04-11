/**
 * export-abis.ts
 *
 * Copies the compiled ABI JSON files and TypeChain types into
 * ../frontend/lib/contracts/ so the Next.js app can import them directly.
 *
 * Run after every compile:
 *   npx hardhat run scripts/export-abis.ts
 */

import * as fs from "fs";
import * as path from "path";

const CONTRACTS = ["ProviderRegistry", "DeploymentEscrow"];
const ARTIFACTS_DIR = path.join(__dirname, "../artifacts/contracts");
const TYPECHAIN_DIR = path.join(__dirname, "../typechain-types");
const OUT_DIR      = path.join(__dirname, "../../frontend/lib/contracts");
const DEPLOYMENTS  = path.join(__dirname, "../deployments.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  for (const name of CONTRACTS) {
    // ── ABI JSON ──────────────────────────────────────────────────────────
    const artifactPath = path.join(ARTIFACTS_DIR, `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`Artifact not found for ${name} — did you run npx hardhat compile?`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abiOut   = { abi: artifact.abi, contractName: artifact.contractName };
    const abiDest  = path.join(OUT_DIR, `${name}.json`);
    fs.writeFileSync(abiDest, JSON.stringify(abiOut, null, 2));
    console.log(`✅ ABI exported: ${abiDest}`);
  }

  // ── deployments.json ──────────────────────────────────────────────────────
  if (fs.existsSync(DEPLOYMENTS)) {
    const dest = path.join(OUT_DIR, "deployments.json");
    fs.copyFileSync(DEPLOYMENTS, dest);
    console.log(`✅ Deployments copied: ${dest}`);
  } else {
    console.warn("deployments.json not found — deploy first, then re-run this script.");
  }

  // ── TypeChain types (index re-export) ─────────────────────────────────────
  const typechainIndex = path.join(TYPECHAIN_DIR, "index.ts");
  if (fs.existsSync(typechainIndex)) {
    const typechainDest = path.join(OUT_DIR, "typechain.ts");
    fs.copyFileSync(typechainIndex, typechainDest);
    console.log(`✅ TypeChain index copied: ${typechainDest}`);
  }

  console.log("\nDone. Import ABIs in the frontend:");
  for (const name of CONTRACTS) {
    console.log(`  import ${name}ABI from '@/lib/contracts/${name}.json'`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
