/**
 * zkLOUD — Become a Compute Provider
 *
 * Usage:
 *   1. Add these vars to your .env (see .env.provider.example):
 *        PROVIDER_PRIVATE_KEY          your wallet private key (must hold >= 0.015 ETH)
 *        PROVIDER_ENDPOINT             public HTTPS URL of your provider API
 *        PROVIDER_PRICE_PER_HOUR_WEI   price in wei per container-hour (default: 0.001 ETH)
 *
 *   2. Run:
 *        npm run become-provider
 *
 *   The script registers you on-chain, stakes the minimum 0.01 ETH, and
 *   prints a Basescan link to your transaction.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { ethers } from "hardhat";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MIN_STAKE = ethers.parseEther("0.01");

async function main() {
  // ── Config validation ──────────────────────────────────────────────────────
  const privateKey = process.env.PROVIDER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("\n❌  Missing PROVIDER_PRIVATE_KEY in .env");
    console.error("    Copy .env.provider.example → .env and fill in your values.\n");
    process.exit(1);
  }

  const endpoint = process.env.PROVIDER_ENDPOINT;
  if (!endpoint || !endpoint.startsWith("http")) {
    console.error("\n❌  Missing or invalid PROVIDER_ENDPOINT in .env");
    console.error("    Example: PROVIDER_ENDPOINT=https://my-node.example.com\n");
    process.exit(1);
  }

  const priceWei = BigInt(process.env.PROVIDER_PRICE_PER_HOUR_WEI ?? "1000000000000000"); // 0.001 ETH

  const registryAddress = process.env.PROVIDER_REGISTRY_ADDRESS;
  if (!registryAddress) {
    console.error("\n❌  Missing PROVIDER_REGISTRY_ADDRESS in .env\n");
    process.exit(1);
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  const provider = ethers.provider;
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifactPath = path.resolve(
    __dirname,
    "../artifacts/contracts/ProviderRegistry.sol/ProviderRegistry.json"
  );
  if (!fs.existsSync(artifactPath)) {
    console.error("\n❌  Artifacts not found. Run: npm run compile\n");
    process.exit(1);
  }

  const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const registry = new ethers.Contract(registryAddress, abi, wallet);

  // ── Banner ─────────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║         zkLOUD — Compute Provider Registration        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`  Wallet   : ${wallet.address}`);
  console.log(`  Endpoint : ${endpoint}`);
  console.log(`  Price    : ${ethers.formatEther(priceWei)} ETH / container-hour`);
  console.log(`  Contract : ${registryAddress}`);

  // ── Balance check ──────────────────────────────────────────────────────────
  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);

  // ── Check existing registration ────────────────────────────────────────────
  const existing = await registry.providers(wallet.address);

  if (existing.wallet !== ethers.ZeroAddress) {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("  ℹ  You are already registered on-chain.\n");
    console.log(`  Status   : ${existing.active ? "✅  Active" : "⚠️   Inactive (stake too low?)"}`);
    console.log(`  Staked   : ${ethers.formatEther(existing.stakedAmount)} ETH`);
    console.log(`  Endpoint : ${existing.endpoint}`);
    console.log(`  Price    : ${ethers.formatEther(existing.pricePerHour)} ETH/hr`);
    console.log(`  Jobs done: ${existing.jobsCompleted}`);
    console.log(`  Slashes  : ${existing.slashCount}`);

    if (!existing.active && existing.stakedAmount < MIN_STAKE) {
      console.log("\n  Your stake dropped below 0.01 ETH. Topping up...");
      const topUp = MIN_STAKE - existing.stakedAmount + ethers.parseEther("0.005");
      const tx = await registry.stake({ value: topUp });
      console.log(`\n  📤  Stake tx : ${tx.hash}`);
      console.log(`      https://sepolia.basescan.org/tx/${tx.hash}`);
      const receipt = await tx.wait(1);
      console.log(`  ✅  Stake confirmed in block ${receipt.blockNumber}. You are active again.\n`);
    } else {
      // Offer to update endpoint/price if different
      const endpointChanged = existing.endpoint !== endpoint;
      const priceChanged = existing.pricePerHour !== priceWei;
      if (endpointChanged || priceChanged) {
        console.log("\n  Detected changes vs current env. Sending update transaction...");
        const tx = await registry.update(endpoint, priceWei);
        console.log(`\n  📤  Update tx : ${tx.hash}`);
        console.log(`      https://sepolia.basescan.org/tx/${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`  ✅  Updated in block ${receipt.blockNumber}.\n`);
      } else {
        console.log("\n  Nothing to update. Your node is live!\n");
      }
    }
    return;
  }

  // ── New registration ───────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────────────────");
  console.log("  New registration. Staking 0.01 ETH minimum...\n");

  const required = MIN_STAKE + ethers.parseEther("0.005"); // stake + gas buffer
  if (balance < required) {
    console.error(
      `  ❌  Insufficient balance. Need at least ${ethers.formatEther(required)} ETH, have ${ethers.formatEther(balance)} ETH\n`
    );
    process.exit(1);
  }

  const tx = await registry.register(endpoint, priceWei, { value: MIN_STAKE });

  console.log(`  📤  Transaction : ${tx.hash}`);
  console.log(`      https://sepolia.basescan.org/tx/${tx.hash}\n`);
  console.log("  Waiting for confirmation...");

  const receipt = await tx.wait(1);

  console.log(`\n  ✅  Registered in block ${receipt.blockNumber}!`);
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  🎉  You are now an active zkLOUD compute provider!   ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\n  Your node is discoverable at:\n  ${endpoint}\n`);
  console.log("  Next steps:");
  console.log("  1. Make sure your provider API is running and reachable");
  console.log("  2. Monitor your node at https://app.zkloud.xyz/providers");
  console.log("  3. Earn ETH every time a user deploys to your node\n");
}

main().catch((e: Error) => {
  console.error("\n❌  Error:", e.message ?? e);
  process.exitCode = 1;
});
