"use client";

import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

const ACCENT = "#7c45ff";

type RentalRow = {
  id: string;
  user: string;
  sessionId: string;
  started: string;
  status: "active" | "completed" | "failed";
  earned: string;
};

const MOCK_RENTALS: RentalRow[] = [
  { id: "rnt_001", user: "0x1a2b…3c4d", sessionId: "sess-demo-001", started: "2024-01-14 10:32", status: "completed", earned: "0.0042" },
  { id: "rnt_002", user: "0x5e6f…7a8b", sessionId: "sess-demo-002", started: "2024-01-14 12:00", status: "active",    earned: "0.0011" },
  { id: "rnt_003", user: "0x9c0d…1e2f", sessionId: "sess-demo-003", started: "2024-01-13 09:15", status: "completed", earned: "0.0031" },
  { id: "rnt_004", user: "0x3a4b…5c6d", sessionId: "sess-demo-004", started: "2024-01-12 16:40", status: "failed",    earned: "0.0000" },
];

const STATUS_COLORS = {
  active:    { text: ACCENT,     bg: "rgba(124,69,255,0.12)" },
  completed: { text: "#28A745",  bg: "rgba(40,167,69,0.10)" },
  failed:    { text: "#DC3545",  bg: "rgba(220,53,69,0.10)" },
};

export default function ProviderOverviewPage() {
  const totalEarned = MOCK_RENTALS.reduce((s, r) => s + parseFloat(r.earned), 0).toFixed(4);
  const activeCount = MOCK_RENTALS.filter((r) => r.status === "active").length;

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Provider Overview</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                Manage your hardware and earn USDC from COMPUT3 users
              </p>
            </div>
            <Link
              href="/provider/register"
              className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-black"
              style={{ background: ACCENT, color: "#fff", textDecoration: "none" }}
            >
              + Register Hardware
            </Link>
          </header>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Earned",          value: totalEarned + " USDC",  accent: true },
              { label: "Active Rentals",         value: String(activeCount),    accent: false },
              { label: "Attestations Issued",    value: "6",                    accent: false },
              { label: "Uptime",                 value: "99.2%",                accent: false },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Recent Rentals */}
          <h2 className="text-lg font-bold mb-4" style={{ color: "#F9FAFB" }}>Recent Rentals</h2>
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "80px 120px 1fr 140px 80px 80px", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>ID</span>
              <span>User</span>
              <span>Session</span>
              <span>Started</span>
              <span>Status</span>
              <span>Earned</span>
            </div>
            {MOCK_RENTALS.map((r) => {
              const sc = STATUS_COLORS[r.status];
              return (
                <div
                  key={r.id}
                  className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                  style={{ gridTemplateColumns: "80px 120px 1fr 140px 80px 80px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.id}</span>
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.user}</span>
                  <Link href={`/sessions/${r.sessionId}`} className="text-xs font-mono hover:underline" style={{ color: ACCENT, textDecoration: "none" }}>
                    {r.sessionId}
                  </Link>
                  <span className="text-xs font-mono" style={{ color: "#6B7280" }}>{r.started}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium w-fit" style={{ color: sc.text, background: sc.bg }}>
                    {r.status}
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: "#F3F4F6" }}>{r.earned}</span>
                </div>
              );
            })}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { label: "Register Hardware", href: "/provider/register", desc: "Add your machine" },
              { label: "View Rentals",       href: "/provider/rentals",  desc: "All rental history" },
              { label: "Earnings",           href: "/provider/earnings", desc: "Revenue breakdown" },
              { label: "Attestations",       href: "/provider/attestations", desc: "Issued proofs" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="rounded-xl p-4 flex flex-col gap-1 transition-colors"
                style={{ background: "#161618", border: "1px solid #2C2C2E", textDecoration: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = ACCENT)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#2C2C2E")}
              >
                <p className="text-sm font-bold" style={{ color: "#F3F4F6" }}>{l.label} →</p>
                <p className="text-xs" style={{ color: "#6B7280" }}>{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
