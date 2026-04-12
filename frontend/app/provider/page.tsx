"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#e2f0d9";

type Session = {
  id: string;
  team_id: string;
  prompt: string;
  state: string;
  created_at: string;
};

type Provider = {
  Wallet: string;
  Endpoint: string;
  PricePerHour: string;
  StakedAmount: string;
  JobsCompleted: string;
  Active: boolean;
};

const STATUS_COLORS = {
  running:   { text: "#e2f0d9", bg: "rgba(226,240,217,0.1)" },
  completed: { text: "#28A745", bg: "rgba(40,167,69,0.10)" },
  failed:    { text: "#DC3545", bg: "rgba(220,53,69,0.10)" },
};

export default function ProviderOverviewPage() {
  const { teamId } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      apiFetch(`/teams/${teamId}/sessions`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    apiFetch("/providers/active")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Provider[]) => { if (Array.isArray(data) && data.length > 0) setProvider(data[0]); })
      .catch(() => {});
  }, [teamId]);

  const activeCount = sessions.filter((s) => s.state === "running").length;
  const completedCount = sessions.filter((s) => s.state === "completed").length;

  return (
    <div className="flex h-screen" style={{ background: "#111111", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-light tracking-tight" style={{ color: "#F9FAFB" }}>Provider Overview</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                {provider ? `${provider.Endpoint} · ${provider.Active ? "active" : "inactive"}` : "Manage your hardware and earn USDC from COMPUT3 users"}
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Staked Amount", value: provider ? (parseInt(provider.StakedAmount) / 1e18).toFixed(4) + " ETH" : "—", accent: true },
              { label: "Active Sessions", value: loading ? "…" : String(activeCount), accent: false },
              { label: "Completed Sessions", value: loading ? "…" : String(completedCount), accent: false },
              { label: "Jobs Completed", value: provider ? provider.JobsCompleted : "—", accent: false },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold mb-4" style={{ color: "#F9FAFB" }}>Recent Sessions</h2>
          <div className="rounded-3xl overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 1fr 140px 80px", color: "#4B5563", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#111111" }}
            >
              <span>Session</span>
              <span>Prompt</span>
              <span>Started</span>
              <span>Status</span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: "#4B5563" }}>No sessions yet.</p>
            )}

            {sessions.map((s) => {
              const sc = STATUS_COLORS[s.state as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.failed;
              return (
                <div
                  key={s.id}
                  className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                  style={{ gridTemplateColumns: "1fr 1fr 140px 80px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Link href={`/sessions/${s.id}`} className="text-xs font-mono hover:underline" style={{ color: ACCENT, textDecoration: "none" }}>
                    {s.id.slice(0, 14)}…
                  </Link>
                  <span className="text-xs font-mono truncate" style={{ color: "#9CA3AF" }}>
                    {s.prompt.slice(0, 40)}{s.prompt.length > 40 ? "…" : ""}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
                    {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium w-fit" style={{ color: sc.text, background: sc.bg }}>
                    {s.state}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { label: "Register Hardware", href: "/provider/register", desc: "Add your machine" },
              { label: "Active Providers", href: "/providers", desc: "Network overview" },
              { label: "Attestations", href: "/attestations", desc: "Issued proofs" },
              { label: "Payments", href: "/payments", desc: "Revenue breakdown" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="rounded-3xl p-4 flex flex-col gap-1 transition-colors"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none" }}
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

