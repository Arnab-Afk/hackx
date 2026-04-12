import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "viem/chains";

// A non-empty placeholder prevents RainbowKit's SSR validation error.
// WalletConnect QR scanning will 403 unless a real project ID is registered
// at cloud.reown.com with the app domain on its allowlist.
// Injected wallets (MetaMask, Coinbase) work regardless of this value.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "COMPUT3 — Trustless Agentic Cloud",
  projectId,
  chains: [baseSepolia],
  ssr: true,
});
