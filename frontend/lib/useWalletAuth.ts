"use client";

import { useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const authenticate = useCallback(async () => {
    if (!address) return;
    try {
      // Request a nonce from the backend
      const nonceRes = await fetch(`${API}/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) return; // Backend auth not yet deployed — silently skip
      const { nonce } = await nonceRes.json();

      // Sign the nonce with the wallet (EIP-191)
      const message = `Sign in to COMPUT3\n\nAddress: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      // Verify and get JWT
      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) return;
      const { token } = await verifyRes.json();
      localStorage.setItem("comput3_jwt", token);
      localStorage.setItem("comput3_wallet", address);
    } catch {
      // Auth endpoint not available yet — no-op for demo
    }
  }, [address, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address) {
      const stored = localStorage.getItem("comput3_wallet");
      if (stored !== address) {
        authenticate();
      }
    }
  }, [isConnected, address, authenticate]);

  return { address, isConnected };
}
