"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/lib/AuthContext";

export default function SignInPage() {
  const { isAuthenticated, isConnected, isAuthenticating, hydrated, authenticate } = useAuth();
  const router = useRouter();

  // Once authenticated, go to dashboard
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  // Blank screen during SSR / hydration to avoid any flash
  if (!hydrated) return null;
  // Already authenticated — will redirect imminently
  if (isAuthenticated) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
      style={{ background: "#111111", fontFamily: "Inter, var(--font-inter), sans-serif" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 select-none">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold"
          style={{ background: "#e2f0d9", color: "#111111" }}
        >
          C
        </div>
        <h1 className="text-3xl font-light tracking-tight text-white">COMPUT3</h1>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Trustless agentic cloud — every deployment is cryptographically proven.
        </p>
      </div>

      {/* Auth card */}
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Sign in</h2>
          <p className="text-xs text-gray-500">
            Connect your wallet and sign the authentication message to access your dashboard.
          </p>
        </div>

        {/* Step 1 — connect wallet */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-600">Step 1 — Connect wallet</span>
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="address"
          />
        </div>

        {/* Step 2 — sign message */}
        {isConnected && !isAuthenticated && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-gray-600">Step 2 — Sign in</span>
            {isAuthenticating ? (
              <button
                disabled
                className="flex items-center justify-center gap-2 w-full rounded-xl h-11 text-sm font-medium"
                style={{ background: "rgba(226,240,217,0.12)", color: "rgba(255,255,255,0.4)", cursor: "default" }}
              >
                <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Waiting for signature…
              </button>
            ) : (
              <button
                onClick={authenticate}
                className="flex items-center justify-center gap-2 w-full rounded-xl h-11 text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: "#e2f0d9", color: "#111111" }}
              >
                Sign in with wallet
              </button>
            )}
            <p className="text-[10px] text-gray-600 text-center">
              A signature request will appear in your wallet. No gas is used.
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-700 text-center max-w-xs">
        By signing in you agree to COMPUT3&apos;s terms. Your key, your cloud.
      </p>
    </div>
  );
}
