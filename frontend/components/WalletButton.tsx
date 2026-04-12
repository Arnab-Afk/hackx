"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/lib/AuthContext";

export function WalletButton() {
  const { isAuthenticated, authenticate, isConnected } = useAuth();

  // If connected but not authenticated (e.g. token expired) show a re-auth button
  if (isConnected && !isAuthenticated) {
    return (
      <button
        onClick={authenticate}
        className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-bold"
        style={{ background: "#7c45ff", color: "#fff" }}
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
