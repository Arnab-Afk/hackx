"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/lib/AuthContext";

export function WalletButton() {
  const { isAuthenticated, authenticate, isConnected, isAuthenticating } = useAuth();

  if (isConnected && isAuthenticating) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-medium"
        style={{ background: "rgba(226,240,217,0.15)", color: "rgba(255,255,255,0.5)", cursor: "default" }}
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Signing in…
      </button>
    );
  }

  if (isConnected && !isAuthenticated) {
    return (
      <button
        onClick={authenticate}
        className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-bold"
        style={{ background: "#e2f0d9", color: "#111111" }}
      >
        Sign in
      </button>
    );
  }

  return (
    <ConnectButton
      chainStatus="icon"
      showBalance={false}
      accountStatus="avatar"
    />
  );
}
