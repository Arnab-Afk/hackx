"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { useBalance } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type Container = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: Record<string, string[]> | null;
  created: string;
};

type SessionSummary = {
  id: string;
  prompt: string;
  state: string;
  created_at: string;
  updated_at: string;
};

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

// Simple bar sparkline for activity
function Sparkline({ bars }: { bars: number[] }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
      {bars.map((v, i) => (
        <div
          key={i}
          className="rounded-sm flex-1 transition-all"
          style={{
            height: `${Math.max(3, Math.round((v / max) * 100))}%`,
            background: i === bars.length - 1 ? "#7c45ff" : "rgba(124,69,255,0.25)",
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const { address, isConnected, teamId, teamName, isNewAccount } = useAuth();
  const { data: balance } = useBalance({ address: address as `0x${string}` | undefined, chainId: baseSepolia.id });
  const clock = useClock();

  const [containers, setContainers] = useState<Container[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [activeTab, setActiveTab] = useState<"containers" | "sessions" | "audit">("containers");

  useEffect(() => {
    if (!teamId) return;

    setLoadingContainers(true);
    apiFetch(`/teams/${teamId}/containers`)
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => { if (Array.isArray(c)) setContainers(c); })
      .catch(() => {})
      .finally(() => setLoadingContainers(false));

    apiFetch(`/teams/${teamId}/sessions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => { if (Array.isArray(s)) setSessions(s); })
      .catch(() => {});
  }, [teamId]);

  const running = containers.filter((c) => c.status === "running").length;

  // Activity bars — last 7 "periods" worth of session counts (fake bucketing by index mod)
  const activityBars = Array.from({ length: 7 }, (_, i) =>
    sessions.filter((_, si) => si % 7 === i).length
  );

  return (
    <div className="flex h-screen" style={{ background: "#08080a", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-8 py-6 flex flex-col gap-6">

          {/* Page header */}
          <header className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#3f3f50" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="text-2xl font-bold tracking-tight" style={{ color: "#f0f0f5" }}>
                {isNewAccount ? "Welcome" : (teamName && !teamName.startsWith("account-") ? teamName : "Dashboard")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#5a5a6e" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {clock}
              </div>
              {isConnected && balance && (
                <div className="px-3 py-1.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#5a5a6e" }}>
                  {parseFloat(balance.formatted).toFixed(4)} ETH
                </div>
              )}
              <WalletButton />
              <Link
                href="/deploy"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold"
                style={{ background: "#7c45ff", color: "#fff" }}
              >
                Deploy
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>
          </header>

          {/* New account banner */}
          {isNewAccount && (
            <Link
              href="/onboarding"
              className="flex items-center justify-between rounded-md px-4 py-3"
              style={{ background: "rgba(124,69,255,0.08)", border: "1px solid rgba(124,69,255,0.3)", textDecoration: "none" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "rgba(124,69,255,0.2)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#f0f0f5" }}>Set up your account</p>
                  <p className="text-xs" style={{ color: "#5a5a6e" }}>Add a display name to personalize your workspace.</p>
                </div>
              </div>
              <span className="text-xs font-semibold" style={{ color: "#7c45ff" }}>Set up →</span>
            </Link>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Running containers */}
            <div className="rounded-md p-4 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3f3f50" }}>Running</p>
                <span className={`w-2 h-2 rounded-full ${running > 0 ? "bg-green-500" : "bg-neutral-700"}`} />
              </div>
              <p className="text-3xl font-bold" style={{ color: "#f0f0f5" }}>{running}</p>
              <p className="text-xs" style={{ color: "#3f3f50" }}>{containers.length} total containers</p>
            </div>

            {/* Total sessions */}
            <div className="rounded-md p-4 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3f3f50" }}>Deployments</p>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3f3f50" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <p className="text-3xl font-bold" style={{ color: "#f0f0f5" }}>{sessions.length}</p>
              <p className="text-xs" style={{ color: "#3f3f50" }}>
                {sessions.filter(s => s.state === "completed").length} completed
              </p>
            </div>

            {/* Network */}
            <div className="rounded-md p-4 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3f3f50" }}>Network</p>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <p className="text-3xl font-bold" style={{ color: "#f0f0f5" }}>Online</p>
              <p className="text-xs" style={{ color: "#3f3f50" }}>Base Sepolia</p>
            </div>

            {/* Activity sparkline */}
            <div className="rounded-md p-4 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3f3f50" }}>Activity</p>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3f3f50" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <polyline points="3 9 9 9 9 21"/>
                  <polyline points="21 9 15 9 15 21"/>
                </svg>
              </div>
              <Sparkline bars={activityBars.length ? activityBars : [0,0,0,0,0,0,0]} />
              <p className="text-xs" style={{ color: "#3f3f50" }}>Deployment frequency</p>
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Pipeline stages */}
            <div className="rounded-md p-4" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: "#f0f0f5" }}>Recent Pipelines</p>
                <Link href="/sessions" className="text-[11px] font-medium" style={{ color: "#7c45ff", textDecoration: "none" }}>
                  View all →
                </Link>
              </div>

              <div className="flex flex-col">
                {sessions.slice(0, 6).map((s, i) => {
                  const dotColor = s.state === "completed" ? "#22c55e" : s.state === "failed" ? "#ef4444" : "#7c45ff";
                  return (
                    <div key={s.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${dotColor}20` }}>
                        {s.state === "completed" ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : s.state === "failed" ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "#c0c0cc" }}>
                          {s.prompt.slice(0, 42)}{s.prompt.length > 42 ? "…" : ""}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#3f3f50" }}>
                          {s.state}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {sessions.length === 0 && (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a2a35" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    <p className="text-xs" style={{ color: "#3f3f50" }}>No pipelines yet</p>
                    <Link href="/deploy" className="text-[11px] font-semibold" style={{ color: "#7c45ff", textDecoration: "none" }}>
                      Start deploying →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Containers/Sessions table */}
            <div className="lg:col-span-2 rounded-md flex flex-col" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Tab bar */}
              <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {(["containers", "sessions", "audit"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
                    style={{
                      color: activeTab === tab ? "#f0f0f5" : "#3f3f50",
                      borderBottom: activeTab === tab ? "2px solid #7c45ff" : "2px solid transparent",
                      background: "transparent",
                    }}
                  >
                    {tab === "containers" ? "Containers" : tab === "sessions" ? "Sessions" : "Audit"}
                  </button>
                ))}
              </div>

              <div className="p-4 flex-1 flex flex-col" style={{ minHeight: 320 }}>
                {activeTab === "containers" && (
                  <>
                    <div
                      className="grid gap-3 pb-2 mb-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ gridTemplateColumns: "1fr 1fr 80px 80px", color: "#2a2a35", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span>Name</span><span>Image</span><span>Status</span><span>Cloud</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {loadingContainers && (
                        <div className="flex items-center justify-center h-24">
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                          </svg>
                        </div>
                      )}
                      {!loadingContainers && containers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 gap-2">
                          <p className="text-xs" style={{ color: "#3f3f50" }}>No containers running</p>
                          <Link href="/deploy" className="text-[11px] rounded px-3 py-1.5 font-bold" style={{ background: "rgba(124,69,255,0.12)", color: "#7c45ff", textDecoration: "none" }}>
                            Deploy first app →
                          </Link>
                        </div>
                      )}
                      {containers.map((c) => (
                        <div
                          key={c.id}
                          className="grid gap-3 py-2.5 transition-colors cursor-pointer"
                          style={{ gridTemplateColumns: "1fr 1fr 80px 80px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.status === "running" ? "#22c55e" : "#2a2a35" }} />
                            <span className="text-xs font-medium truncate" style={{ color: "#c0c0cc" }}>{c.name}</span>
                          </div>
                          <span className="text-[11px] font-mono truncate" style={{ color: "#3f3f50" }}>{c.image}</span>
                          <span className="text-[11px] font-medium" style={{ color: c.status === "running" ? "#22c55e" : "#3f3f50" }}>
                            {c.status === "running" ? "Running" : "Stopped"}
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: "#3f3f50", background: "rgba(255,255,255,0.04)", width: "fit-content" }}>
                            docker
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeTab === "sessions" && (
                  <div className="flex-1 rounded font-mono text-xs overflow-y-auto p-3" style={{ background: "#060608", border: "1px solid rgba(255,255,255,0.05)", color: "#5a5a6e" }}>
                    {sessions.length === 0 && (
                      <p style={{ color: "#2a2a35" }}>No sessions yet.</p>
                    )}
                    {sessions.map((s) => (
                      <p key={s.id} className="mb-1 leading-relaxed">
                        <span style={{ color: "#2a2a35" }}>{new Date(s.created_at).toLocaleTimeString()}&nbsp;</span>
                        <span style={{ color: s.state === "completed" ? "#22c55e" : s.state === "failed" ? "#ef4444" : "#7c45ff" }}>
                          [{s.state}]&nbsp;
                        </span>
                        <span style={{ color: "#5a5a6e" }}>{s.prompt.slice(0, 72)}{s.prompt.length > 72 ? "…" : ""}</span>
                      </p>
                    ))}
                    <p className="animate-pulse mt-1" style={{ color: "#2a2a35" }}>▌</p>
                  </div>
                )}

                {activeTab === "audit" && (
                  <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
                    {sessions.map((s) => (
                      <Link
                        key={s.id}
                        href={`/sessions/${s.id}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded transition-colors"
                        style={{ border: "1px solid rgba(255,255,255,0.04)", textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                            {s.state === "completed" ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : s.state === "failed" ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            ) : (
                              <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs truncate" style={{ color: "#c0c0cc" }}>{s.prompt.slice(0, 50)}{s.prompt.length > 50 ? "…" : ""}</p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: "#2a2a35" }}>{s.id.slice(0, 14)}…</p>
                          </div>
                        </div>
                        <div className="shrink-0 ml-3 flex flex-col items-end gap-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                            style={{
                              color: s.state === "completed" ? "#22c55e" : s.state === "failed" ? "#ef4444" : "#f59e0b",
                              background: "rgba(255,255,255,0.05)",
                            }}
                          >
                            {s.state}
                          </span>
                          <Link href={`/verify/${s.id}`} className="text-[10px] font-semibold" style={{ color: "#7c45ff", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                            verify →
                          </Link>
                        </div>
                      </Link>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-xs py-8 text-center" style={{ color: "#3f3f50" }}>No audit entries yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "New Deployment", href: "/deploy", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> },
              { label: "Manage Secrets", href: "/secrets", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l2 2"/></svg> },
              { label: "Attestations", href: "/attestations", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { label: "Payments", href: "/payments", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
            ].map(({ label, href, icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors"
                style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)", color: "#5a5a6e", textDecoration: "none" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#c0c0cc";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#5a5a6e";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}


export default function Home() {
  const { address, isConnected, teamId } = useAuth();
  const { data: balance } = useBalance({ address: address as `0x${string}` | undefined, chainId: baseSepolia.id });

  const [containers, setContainers] = useState<Container[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [activeTab, setActiveTab] = useState<"containers" | "sessions" | "audit">("containers");

  useEffect(() => {
    if (!teamId) return;

    setLoadingContainers(true);
    apiFetch(`/teams/${teamId}/containers`)
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => { if (Array.isArray(c)) setContainers(c); })
      .catch(() => {})
      .finally(() => setLoadingContainers(false));

    apiFetch(`/teams/${teamId}/sessions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => { if (Array.isArray(s)) setSessions(s); })
      .catch(() => {});
  }, [teamId]);

  const running = containers.filter((c) => c.status === "running").length;
  const stopped = containers.length - running;

  const statCards = [
    {
      label: "Overall Status",
      value: running > 0 ? "Running" : "Idle",
      accent: running > 0,
      spinning: running > 0,
    },
    { label: "Start Time", value: "10:00:15 AM", accent: false, spinning: false },
    { label: "Containers", value: String(containers.length), accent: false, spinning: false },
    {
      label: "Triggered By",
      value: isConnected && address ? address.slice(0, 8) + "…" : "—",
      accent: false,
      spinning: false,
    },
  ];

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          {/* Page header */}
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Dashboard</p>
              <p className="text-sm font-mono" style={{ color: "#6B7280" }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#28A745" }} />
                  Base Sepolia&nbsp;·&nbsp;3 providers online
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <WalletButton />
              {isConnected && address && (
                <a
                  href={`https://sepolia.basescan.org/address/0x5f4eb5a650Cc01c93e1c6A94a06d7551b6b35E76`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-bold transition-colors"
                  style={{ background: "#2A2A2D", color: "#E5E7EB" }}
                >
                  {balance ? parseFloat(balance.formatted).toFixed(4) : "—"} ETH
                </a>
              )}
              <Link
                href="/deploy"
                className="flex items-center gap-2 justify-center rounded-lg h-10 px-4 text-sm font-black tracking-wide"
                style={{ background: "#7c45ff", color: "#000000" }}
              >
                Start deploying →
              </Link>
            </div>
          </header>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => (
              <div key={s.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{s.label}</p>
                <p className="text-2xl font-bold leading-tight flex items-center gap-2" style={{ color: s.accent ? "#7c45ff" : "#F9FAFB" }}>
                  {s.spinning && (
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity="0.2"/>
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                  )}
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Main two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Pipeline stages / recent sessions */}
            <div className="lg:col-span-1">
              <h2 className="text-xl font-bold mb-4" style={{ color: "#F9FAFB" }}>Pipeline Stages</h2>
              <div className="grid grid-cols-[auto_1fr] gap-x-4">
                {sessions.slice(0, 5).map((s, i) => {
                  const isLast = i === Math.min(sessions.length - 1, 4);
                  const isActive = s.state !== "completed" && s.state !== "failed";
                  const dotColor = s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#7c45ff";
                  const dotBg = s.state === "completed" ? "rgba(40,167,69,0.15)" : s.state === "failed" ? "rgba(220,53,69,0.15)" : "rgba(124,69,255,0.15)";
                  return (
                    <>
                      <div key={`dot-${s.id}`} className="flex flex-col items-center gap-1">
                        {i > 0 && <div className="w-[2px]" style={{ background: "#2C2C2E", height: "8px" }} />}
                        <div className="flex items-center justify-center rounded-full p-1.5" style={{ color: dotColor, background: dotBg }}>
                          {s.state === "completed" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : s.state === "failed" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          ) : (
                            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                          )}
                        </div>
                        {!isLast && <div className="w-[2px] grow" style={{ background: "#2C2C2E" }} />}
                      </div>
                      <div
                        key={`info-${s.id}`}
                        className="flex flex-1 flex-col pb-5 pl-1"
                        style={isActive ? { background: "#161618", border: "1px solid #7c45ff", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px" } : {}}
                      >
                        <p className="text-sm font-medium leading-snug" style={{ color: isActive ? "#7c45ff" : "#F3F4F6" }}>
                          {s.prompt.slice(0, 48)}{s.prompt.length > 48 ? "…" : ""}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#9CA3AF" }}>
                          {s.state.charAt(0).toUpperCase() + s.state.slice(1)}
                        </p>
                      </div>
                    </>
                  );
                })}
                {sessions.length === 0 && (
                  <div className="col-span-2 py-8 text-center">
                    <p className="text-sm" style={{ color: "#4B5563" }}>No deployments yet.</p>
                    <Link href="/deploy" className="text-xs mt-2 block" style={{ color: "#7c45ff" }}>Start your first deployment →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Containers/Sessions table with tabs */}
            <div className="lg:col-span-2 rounded-xl overflow-hidden flex flex-col" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
              <div className="flex" style={{ borderBottom: "1px solid #2C2C2E" }}>
                {(["containers", "sessions", "audit"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-3 text-sm font-semibold capitalize transition-colors"
                    style={{
                      color: activeTab === tab ? "#F9FAFB" : "#6B7280",
                      borderBottom: activeTab === tab ? "2px solid #7c45ff" : "2px solid transparent",
                      background: "transparent",
                    }}
                  >
                    {tab === "containers" ? "Logs" : tab === "sessions" ? "Details" : "Audit Trail"}
                  </button>
                ))}
              </div>

              <div className="p-4 flex-1 flex flex-col" style={{ minHeight: "420px" }}>
                {activeTab === "containers" && (
                  <>
                    {/* Table header */}
                    <div
                      className="grid gap-4 pb-2 mb-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ gridTemplateColumns: "1fr 1fr 90px 90px 110px 28px", color: "#4B5563", borderBottom: "1px solid #2C2C2E" }}
                    >
                      <span>Name</span><span>Image</span><span>Cloud</span><span>Status</span><span>Attestation</span><span />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {loadingContainers && (
                        <div className="flex items-center justify-center h-full">
                          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                          </svg>
                        </div>
                      )}
                      {!loadingContainers && containers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                          <p className="text-sm" style={{ color: "#4B5563" }}>No containers running</p>
                          <Link href="/deploy" className="text-xs rounded-lg px-3 py-1.5 font-bold" style={{ background: "#7c45ff", color: "#000" }}>Deploy your first app →</Link>
                        </div>
                      )}
                      {containers.map((c) => (
                        <div
                          key={c.id}
                          className="grid gap-4 py-3 rounded-lg cursor-pointer transition-colors"
                          style={{
                            gridTemplateColumns: "1fr 1fr 90px 90px 110px 28px",
                            alignItems: "center",
                            borderBottom: "1px solid rgba(44,44,46,0.6)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.status === "running" ? "#28A745" : "#4B5563" }} />
                            <span className="text-sm font-medium truncate" style={{ color: "#F3F4F6" }}>{c.name}</span>
                          </div>
                          <span className="text-xs font-mono truncate" style={{ color: "#9CA3AF" }}>{c.image}</span>
                          <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ color: "#9CA3AF", background: "#2A2A2D", width: "fit-content" }}>docker</span>
                          <span className="text-xs font-medium" style={{ color: c.status === "running" ? "#28A745" : "#6B7280" }}>
                            {c.status === "running" ? "Running" : "Stopped"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2.5">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span className="text-xs" style={{ color: "#FFC107" }}>Pending</span>
                          </div>
                          <div style={{ color: "#4B5563" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeTab === "sessions" && (
                  <div className="flex-1 rounded-lg font-mono text-sm overflow-y-auto p-4" style={{ background: "#0A0A0A", border: "1px solid #2C2C2E", color: "#9CA3AF" }}>
                    {sessions.length === 0 && (
                      <p className="text-xs" style={{ color: "#4B5563" }}>No sessions yet.</p>
                    )}
                    {sessions.map((s) => (
                      <p key={s.id} className="mb-1">
                        <span style={{ color: "#4B5563" }}>{s.created_at || "—"}&nbsp;</span>
                        <span style={{ color: s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#7c45ff" }}>
                          [{s.state.toUpperCase()}]&nbsp;
                        </span>
                        {s.prompt.slice(0, 80)}{s.prompt.length > 80 ? "…" : ""}
                      </p>
                    ))}
                    <p className="animate-pulse mt-2" style={{ color: "#4B5563" }}>_</p>
                  </div>
                )}

                {activeTab === "audit" && (
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                    {sessions.map((s) => (
                      <Link
                        key={s.id}
                        href={`/sessions/${s.id}`}
                        className="flex items-center justify-between p-3 rounded-lg transition-colors"
                        style={{ background: "#1E1E20", border: "1px solid #2C2C2E", textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#252528")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#1E1E20")}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: "#2A2A2D" }}>
                            {s.state === "completed" ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : s.state === "failed" ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC3545" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            ) : (
                              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ color: "#F3F4F6" }}>{s.prompt.slice(0, 50)}{s.prompt.length > 50 ? "…" : ""}</p>
                            <p className="text-xs font-mono" style={{ color: "#4B5563" }}>{s.id.slice(0, 14)}…</p>
                          </div>
                        </div>
                        <div className="shrink-0 ml-3 text-right">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{
                              color: s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#FFC107",
                              background: "#2A2A2D",
                            }}
                          >
                            {s.state.toUpperCase()}
                          </span>
                          <Link href={`/verify/${s.id}`} className="text-xs mt-1 block" style={{ color: "#7c45ff" }} onClick={(e) => e.stopPropagation()}>
                            verify →
                          </Link>
                        </div>
                      </Link>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-sm py-8 text-center" style={{ color: "#4B5563" }}>No audit entries yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
