import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, coinbaseWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "viem/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// If no valid WalletConnect project ID is set, use injected wallets only (no WalletConnect)
// to avoid 403 errors from unregistered origins.
export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: "COMPUT3 — Trustless Agentic Cloud",
      projectId,
      chains: [baseSepolia],
      ssr: true,
    })
  : createConfig({
      chains: [baseSepolia],
      connectors: connectorsForWallets(
        [{ groupName: "Wallets", wallets: [injectedWallet, metaMaskWallet, coinbaseWallet] }],
        { appName: "COMPUT3 — Trustless Agentic Cloud", projectId: "" }
      ),
      transports: { [baseSepolia.id]: http() },
      ssr: true,
    });
