"use client";

import { Sidebar } from "@/components/Sidebar";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { useBalance } from "wagmi";

const ACCENT = "#7c45ff";

type Payment = {
  id: string;
  sessionId: string;
  amount: string;
  currency: string;
  status: "confirmed" | "pending" | "failed";
  timestamp: string;
  txHash: string;
};

const MOCK_PAYMENTS: Payment[] = [
  {
    id: "pay_01",
    sessionId: "sess_abc123",
    amount: "0.0042",
    currency: "USDC",
    status: "confirmed",
    timestamp: "2024-01-14 10:32",
    txHash: "0xf1e2d3c4b5a697…",
  },
  {
    id: "pay_02",
    sessionId: "sess_def456",
    amount: "0.0018",
    currency: "USDC",
    status: "confirmed",
    timestamp: "2024-01-13 14:08",
    txHash: "0xa8b7c6d5e4f302…",
  },
  {
    id: "pay_03",
    sessionId: "sess_ghi789",
    amount: "0.0031",
    currency: "USDC",
    status: "confirmed",
    timestamp: "2024-01-12 09:55",
    txHash: "0x1234567890abcd…",
  },
];

const STATUS_COLORS = {
  confirmed: { text: "#28A745", bg: "rgba(40,167,69,0.1)" },
  pending: { text: "#FFC107", bg: "rgba(255,193,7,0.1)" },
  failed: { text: "#DC3545", bg: "rgba(220,53,69,0.1)" },
};

export default function PaymentsPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, chainId: baseSepolia.id });

  const totalSpent = MOCK_PAYMENTS
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0)
    .toFixed(4);

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="mb-6">
            <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Payments</p>
            <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
              x402 micro-payments on Base Sepolia
            </p>
          </header>

          {/* Balance + stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "USDC Balance",
                value: balance ? parseFloat(balance.formatted).toFixed(4) + " ETH" : "—",
                accent: true,
              },
              { label: "Total Spent", value: totalSpent + " USDC", accent: false },
              { label: "Transactions", value: String(MOCK_PAYMENTS.length), accent: false },
              { label: "Protocol", value: "x402", accent: false },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Payments Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "100px 1fr 100px 80px 140px 1fr", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Payment ID</span>
              <span>Session</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Time</span>
              <span>Tx Hash</span>
            </div>
            {MOCK_PAYMENTS.map((p) => {
              const sc = STATUS_COLORS[p.status];
              return (
                <div
                  key={p.id}
                  className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                  style={{ gridTemplateColumns: "100px 1fr 100px 80px 140px 1fr", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{p.id}</span>
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{p.sessionId}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: "#F3F4F6" }}>
                    {p.amount} <span style={{ color: "#6B7280", fontSize: "10px" }}>{p.currency}</span>
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium w-fit"
                    style={{ color: sc.text, background: sc.bg }}
                  >
                    {p.status}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#4B5563" }}>{p.timestamp}</span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${p.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono hover:underline flex items-center gap-1"
                    style={{ color: ACCENT }}
                  >
                    {p.txHash}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
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
