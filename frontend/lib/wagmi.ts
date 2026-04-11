import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "viem/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "COMPUT3 — Trustless Agentic Cloud",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "9b9d6ad3b2f7e8c5a1d4f0e3b8c72a1d",
  chains: [baseSepolia],
  ssr: true,
});
