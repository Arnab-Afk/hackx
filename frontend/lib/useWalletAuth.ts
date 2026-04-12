"use client";

import { useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const authenticate = useCallback(async () => {
    if (!address) return;
    // Mark wallet as seen immediately so we don't re-prompt on next render
    localStorage.setItem("comput3_wallet", address.toLowerCase());
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
      localStorage.setItem("comput3_wallet", address.toLowerCase());
    } catch {
      // Auth endpoint not available yet — no-op for demo
    }
  }, [address, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address) {
      const storedWallet = localStorage.getItem("comput3_wallet");
      const storedToken = localStorage.getItem("comput3_jwt");

      // Normalize address comparison (wagmi may return checksummed address)
      const walletMatches = storedWallet?.toLowerCase() === address.toLowerCase();

      // Check token isn't expired (JWT payload is base64url middle segment)
      let tokenValid = false;
      if (storedToken) {
        try {
          const payload = JSON.parse(atob(storedToken.split(".")[1] ?? ""));
          tokenValid = payload.exp ? payload.exp * 1000 > Date.now() : true;
        } catch {
          tokenValid = false;
        }
      }

      if (!walletMatches || !tokenValid) {
        authenticate();
      }
    }
  }, [isConnected, address, authenticate]);

  return { address, isConnected };
}
