"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

const ACCENT = "#7c45ff";

type Rental = {
  id: string;
  user: string;
  sessionId: string;
  started: string;
  ended: string | null;
  status: "active" | "completed" | "failed";
  earnedUsdc: string;
  luks: "sealed" | "open";
};

const MOCK_RENTALS: Rental[] = [
  { id: "rnt_001", user: "0x1a2b…3c4d", sessionId: "sess-demo-001", started: "2024-01-14 10:32", ended: "2024-01-14 11:04", status: "completed", earnedUsdc: "0.0042", luks: "sealed" },
  { id: "rnt_002", user: "0x5e6f…7a8b", sessionId: "sess-demo-002", started: "2024-01-14 12:00", ended: null,                status: "active",    earnedUsdc: "0.0011", luks: "open" },
  { id: "rnt_003", user: "0x9c0d…1e2f", sessionId: "sess-demo-003", started: "2024-01-13 09:15", ended: "2024-01-13 09:45", status: "completed", earnedUsdc: "0.0031", luks: "sealed" },
  { id: "rnt_004", user: "0x3a4b…5c6d", sessionId: "sess-demo-004", started: "2024-01-12 16:40", ended: "2024-01-12 16:52", status: "failed",    earnedUsdc: "0.0000", luks: "sealed" },
];

const STATUS_STYLE: Record<string, { text: string; bg: string }> = {
  active:    { text: ACCENT,    bg: "rgba(124,69,255,0.12)" },
  completed: { text: "#28A745", bg: "rgba(40,167,69,0.10)" },
  failed:    { text: "#DC3545", bg: "rgba(220,53,69,0.10)" },
};
const LUKS_STYLE: Record<string, { text: string; bg: string }> = {
  sealed: { text: "#28A745", bg: "rgba(40,167,69,0.10)" },
  open:   { text: ACCENT,    bg: "rgba(124,69,255,0.12)" },
};

export default function ProviderRentalsPage() {
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  const filtered = filter === "all" ? MOCK_RENTALS : MOCK_RENTALS.filter((r) => r.status === filter);

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Rentals</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>All compute sessions hosted on your hardware</p>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1 rounded-lg p-1" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
              {(["all", "active", "completed", "failed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: filter === f ? ACCENT : "transparent",
                    color: filter === f ? "#fff" : "#6B7280",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </header>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "80px 120px 1fr 130px 80px 100px 90px 80px", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>ID</span>
              <span>User</span>
              <span>Session</span>
              <span>Started</span>
              <span>Status</span>
              <span>LUKS</span>
              <span>Earned</span>
              <span></span>
            </div>
            {filtered.map((r) => {
              const ss = STATUS_STYLE[r.status];
              const ls = LUKS_STYLE[r.luks];
              return (
                <div
                  key={r.id}
                  className="grid gap-3 px-5 py-3.5 items-center transition-colors"
                  style={{ gridTemplateColumns: "80px 120px 1fr 130px 80px 100px 90px 80px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.id}</span>
                  <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{r.user}</span>
                  <Link href={`/sessions/${r.sessionId}`} className="text-xs font-mono hover:underline" style={{ color: ACCENT, textDecoration: "none" }}>
                    {r.sessionId}
                  </Link>
                  <span className="text-xs font-mono" style={{ color: "#6B7280" }}>{r.started}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium w-fit" style={{ color: ss.text, background: ss.bg }}>{r.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium w-fit" style={{ color: ls.text, background: ls.bg }}>{r.luks}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: "#F3F4F6" }}>{r.earnedUsdc} <span style={{ fontSize: "10px", color: "#6B7280" }}>USDC</span></span>
                  <Link href={`/verify/${r.sessionId}`} className="text-xs hover:underline" style={{ color: ACCENT, textDecoration: "none" }}>verify →</Link>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: "#4B5563" }}>No rentals found.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
