"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { useBalance } from "wagmi";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#e2f0d9";

type Payment = {
  id: number;
  wallet: string;
  session_id?: string;
  amount_usdc: string;
  tx_hash?: string;
  nonce?: string;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  confirmed: { text: "#28A745", bg: "rgba(40,167,69,0.1)" },
  pending:   { text: "#FFC107", bg: "rgba(255,193,7,0.1)" },
  failed:    { text: "#DC3545", bg: "rgba(220,53,69,0.1)" },
};

export default function PaymentsPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, chainId: baseSepolia.id });
  const { address: authAddress } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (authAddress) {
      navigator.clipboard.writeText(authAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  useEffect(() => {
    apiFetch("/payments")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPayments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = payments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + parseFloat(p.amount_usdc ?? "0") / 1e6, 0)
    .toFixed(4);

  return (
    <div className="flex h-screen" style={{ background: "#111111", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="mb-6">
            <p className="text-3xl font-light tracking-tight" style={{ color: "#F9FAFB" }}>Payments</p>
            <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
              x402 micro-payments on Base Sepolia
            </p>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Spent", value: totalSpent + " USDC", accent: false },
              { label: "Transactions", value: loading ? "…" : String(payments.length), accent: false },
              { label: "Protocol", value: "x402", accent: false },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Fund Wallet section */}
            <div className="p-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#F9FAFB" }}>Fund Your Wallet</p>
              <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
                Send USDC or ETH on Base Sepolia to your connected wallet to pay for compute sessions via x402.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Wallet address display */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono flex-1 min-w-0" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#9CA3AF" }}>
                  <span className="truncate">{authAddress ?? "Connect wallet"}</span>
                </div>
                <button
                  onClick={copyAddress}
                  disabled={!authAddress}
                  className="shrink-0 text-xs px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: ACCENT, color: "#111111" }}
                >
                  {copied ? "Copied!" : "Copy Address"}
                </button>
                <a
                  href="https://bridge.base.org/deposit"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "#1f2937", color: "#e2f0d9", border: "1px solid rgba(226,240,217,0.15)" }}
                >
                  Bridge to Base ↗
                </a>
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "#1f2937", color: "#9CA3AF" }}
                >
                  USDC Faucet ↗
                </a>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    Balance: <span className="font-mono" style={{ color: "#F9FAFB" }}>{balance ? parseFloat(balance.formatted).toFixed(4) + " " + balance.symbol : "—"}</span>
                  </span>
                </div>
                <span className="text-xs" style={{ color: "#374151" }}>Network: Base Sepolia</span>
              </div>
            </div>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 100px 80px 140px 1fr", color: "#4B5563", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#111111" }}
            >
              <span>Session / Nonce</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Time</span>
              <span>Tx Hash</span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              </div>
            )}

            {!loading && payments.length === 0 && (
              <p className="px-5 py-10 text-sm text-center" style={{ color: "#4B5563" }}>
                No payments yet. Payments appear after x402 sessions are created.
              </p>
            )}

            {payments.map((p) => {
              const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.pending;
              const displayAmount = (parseFloat(p.amount_usdc ?? "0") / 1e6).toFixed(6);
              return (
                <div
                  key={p.id}
                  className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                  style={{ gridTemplateColumns: "1fr 100px 80px 140px 1fr", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-xs font-mono truncate" style={{ color: "#9CA3AF" }}>
                    {p.session_id || p.nonce?.slice(0, 18) || "—"}
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: "#F3F4F6" }}>
                    {displayAmount} <span style={{ color: "#6B7280", fontSize: "10px" }}>USDC</span>
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium w-fit" style={{ color: sc.text, background: sc.bg }}>
                    {p.status}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#4B5563" }}>
                    {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                  </span>
                  {p.tx_hash ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${p.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono hover:underline flex items-center gap-1 truncate"
                      style={{ color: ACCENT }}
                    >
                      {p.tx_hash.slice(0, 20)}…
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ) : (
                    <span className="text-xs font-mono" style={{ color: "#4B5563" }}>pending…</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs" style={{ color: "#4B5563" }}>
            Payments use the x402 protocol — USDC micro-payments streamed per second on Base.
          </p>
        </div>
      </main>
    </div>
  );
}

