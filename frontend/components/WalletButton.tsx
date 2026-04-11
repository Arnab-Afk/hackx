"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletAuth } from "@/lib/useWalletAuth";

export function WalletButton() {
  useWalletAuth(); // auto-signs JWT on connect
  return (
    <ConnectButton
      chainStatus="icon"
      showBalance={false}
      accountStatus="avatar"
    />
  );
}
