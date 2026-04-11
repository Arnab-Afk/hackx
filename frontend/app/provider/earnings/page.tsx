"use client";

import { Sidebar } from "@/components/Sidebar";

const ACCENT = "#7c45ff";

type EarningRow = {
  sessionId: string;
  user: string;
  duration: string;
  amount: string;
  date: string;
};

const EARNING_ROWS: EarningRow[] = [
  { sessionId: "sess-demo-001", user: "0x1a2b…3c4d", duration: "32m",  amount: "0.0042", date: "Jan 14" },
  { sessionId: "sess-demo-002", user: "0x5e6f…7a8b", duration: "9m",   amount: "0.0011", date: "Jan 14" },
  { sessionId: "sess-demo-003", user: "0x9c0d…1e2f", duration: "30m",  amount: "0.0031", date: "Jan 13" },
  { sessionId: "sess-demo-005", user: "0x7a8b…9c0d", duration: "18m",  amount: "0.0024", date: "Jan 12" },
  { sessionId: "sess-demo-006", user: "0x2b3c…4d5e", duration: "45m",  amount: "0.0058", date: "Jan 11" },
];

// Weekly earning totals for bar chart
const WEEKLY_DATA = [
  { label: "Jan 8",  amount: 0.0035 },
  { label: "Jan 9",  amount: 0.0052 },
  { label: "Jan 10", amount: 0.0021 },
  { label: "Jan 11", amount: 0.0058 },
  { label: "Jan 12", amount: 0.0031 },
  { label: "Jan 13", amount: 0.0031 },
  { label: "Jan 14", amount: 0.0053 },
];

export default function ProviderEarningsPage() {
  const totalEarned = EARNING_ROWS.reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(4);
  const maxBar = Math.max(...WEEKLY_DATA.map((d) => d.amount));

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="mb-6">
            <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Earnings</p>
            <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>USDC earned from compute sessions on your hardware</p>
          </header>

          {/* Top stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Earned",     value: totalEarned + " USDC", accent: true },
              { label: "Sessions Hosted",  value: String(EARNING_ROWS.length) },
              { label: "This Week",        value: WEEKLY_DATA.reduce((s, d) => s + d.amount, 0).toFixed(4) + " USDC" },
              { label: "Avg per Session",  value: (parseFloat(totalEarned) / EARNING_ROWS.length).toFixed(4) + " USDC" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Bar chart */}
            <div className="rounded-xl p-5" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
              <p className="text-sm font-bold mb-5" style={{ color: "#F9FAFB" }}>Last 7 Days</p>
              <div className="flex items-end gap-3 h-36">
                {WEEKLY_DATA.map((d) => {
                  const pct = (d.amount / maxBar) * 100;
                  return (
                    <div key={d.label} className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-full rounded-t-sm relative group" style={{ height: `${pct}%`, background: ACCENT, opacity: 0.8, minHeight: "4px" }}>
                        <div
                          className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                          style={{ background: "#2A2A2D", color: "#F3F4F6" }}
                        >
                          {d.amount}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: "#4B5563" }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Withdraw card */}
            <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
              <p className="text-sm font-bold" style={{ color: "#F9FAFB" }}>Withdraw Earnings</p>
              <div className="flex flex-col gap-2 rounded-lg p-4" style={{ background: "#0A0A0A", border: "1px solid #2C2C2E" }}>
                <p className="text-xs" style={{ color: "#6B7280" }}>Available balance</p>
                <p className="text-2xl font-black font-mono" style={{ color: ACCENT }}>{totalEarned} USDC</p>
              </div>
              <button
                disabled
                className="h-10 rounded-lg text-sm font-black opacity-30 cursor-not-allowed"
                style={{ background: ACCENT, color: "#fff" }}
              >
                Withdraw (coming soon)
              </button>
              <p className="text-xs" style={{ color: "#4B5563" }}>Withdrawals will be enabled when the protocol launches on mainnet.</p>
            </div>
          </div>

          {/* Per-session table */}
          <h2 className="text-lg font-bold mb-4" style={{ color: "#F9FAFB" }}>Session Breakdown</h2>
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 120px 80px 100px 100px", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Session</span>
              <span>User</span>
              <span>Duration</span>
              <span>Date</span>
              <span>Earned</span>
            </div>
            {EARNING_ROWS.map((r) => (
              <div
                key={r.sessionId}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                style={{ gridTemplateColumns: "1fr 120px 80px 100px 100px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-xs font-mono" style={{ color: ACCENT }}>{r.sessionId}</span>
                <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.user}</span>
                <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.duration}</span>
                <span className="text-xs font-mono" style={{ color: "#6B7280" }}>{r.date}</span>
                <span className="text-sm font-bold font-mono" style={{ color: "#F3F4F6" }}>{r.amount} <span style={{ fontSize: "10px", color: "#6B7280" }}>USDC</span></span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
