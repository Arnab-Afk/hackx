import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // ─── Deploy ProviderRegistry ───────────────────────────────────────────────
  console.log("Deploying ProviderRegistry...");
  const ProviderRegistry = await ethers.getContractFactory("ProviderRegistry");
  // Owner = deployer; slash authority = deployer initially (update after backend wallet is known)
  const registry = await ProviderRegistry.deploy(deployer.address, deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ProviderRegistry deployed to:", registryAddress);

  // ─── Deploy DeploymentEscrow ───────────────────────────────────────────────
  console.log("\nDeploying DeploymentEscrow...");
  const DeploymentEscrow = await ethers.getContractFactory("DeploymentEscrow");
  // Args: initialOwner, releaseAuthority, registry address
  const escrow = await DeploymentEscrow.deploy(deployer.address, deployer.address, registryAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("DeploymentEscrow deployed to:", escrowAddress);

  // ─── Save deployment addresses ─────────────────────────────────────────────
  const deployments: Record<string, Record<string, string>> = {};
  const deploymentsPath = path.join(__dirname, "../deployments.json");

  if (fs.existsSync(deploymentsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
      Object.assign(deployments, existing);
    } catch { /* ignore parse errors on first run */ }
  }

  deployments[network.name] = {
    ProviderRegistry: registryAddress,
    DeploymentEscrow: escrowAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("\nDeployment addresses saved to deployments.json");

  // ─── Verify on Basescan (skip on local hardhat network) ───────────────────
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 5 blocks before verification...");
    // Wait a few seconds for Basescan to index the contracts
    await new Promise((r) => setTimeout(r, 20_000));

    console.log("Verifying ProviderRegistry...");
    try {
      await run("verify:verify", {
        address: registryAddress,
        constructorArguments: [deployer.address, deployer.address],
      });
    } catch (e: any) {
      console.warn("ProviderRegistry verification failed:", e.message);
    }

    console.log("Verifying DeploymentEscrow...");
    try {
      await run("verify:verify", {
        address: escrowAddress,
        constructorArguments: [deployer.address, deployer.address, registryAddress],
      });
    } catch (e: any) {
      console.warn("DeploymentEscrow verification failed:", e.message);
    }
  }

  console.log("\n✅ Deploy complete.");
  console.log(`   ProviderRegistry : ${registryAddress}`);
  console.log(`   DeploymentEscrow : ${escrowAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
