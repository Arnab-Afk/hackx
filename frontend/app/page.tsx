"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { useAccount, useBalance } from "wagmi";
import { baseSepolia } from "viem/chains";
import { MOCK_CONTAINERS, MOCK_SESSIONS } from "@/lib/mockData";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="7.5" cy="15.5" r="4.5"/>
      <path d="M21 2l-9.6 9.6M15.5 7.5l2 2"/>
    </svg>
  );
}
function IconCloud() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 1 .5 4M3 16v-5h5"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function Sidebar({ active }: { active: string }) {
  const navItems = [
    { label: "Dashboard", icon: <IconDashboard />, href: "/" },
    { label: "Pipelines", icon: <IconPipeline />, href: "/deploy" },
    { label: "Secrets", icon: <IconKey />, href: "#" },
    { label: "Environments", icon: <IconCloud />, href: "#" },
    { label: "Audit Trails", icon: <IconHistory />, href: "#" },
  ];

  return (
    <aside className="flex-shrink-0 w-64 flex flex-col justify-between p-4" style={{ background: "#101012" }}>
      <div className="flex flex-col gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,191,255,0.12)", border: "1px solid rgba(0,191,255,0.25)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-white text-sm font-bold leading-tight">Zkloud</h1>
            <p className="text-xs leading-tight" style={{ color: "#6B7280" }}>DevSecOps</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 mt-2">
          {navItems.map(({ label, icon, href }) => {
            const isActive = label === active;
            return (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: isActive ? "#00BFFF" : "#9CA3AF",
                  background: isActive ? "rgba(0,191,255,0.1)" : "transparent",
                  textDecoration: "none",
                }}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-1">
        <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors" style={{ color: "#9CA3AF", textDecoration: "none" }}>
          <IconSettings />
          Settings
        </Link>
        <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium" style={{ color: "#9CA3AF", textDecoration: "none" }}>
          <IconHelp />
          Help
        </Link>
      </div>
    </aside>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: baseSepolia.id });

  const [containers, setContainers] = useState<Container[]>(MOCK_CONTAINERS);
  const [sessions, setSessions] = useState<SessionSummary[]>(MOCK_SESSIONS);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [activeTab, setActiveTab] = useState<"containers" | "sessions" | "audit">("containers");

  useEffect(() => {
    const teamId = localStorage.getItem("zkloud_team_id");
    if (!teamId) return;

    setLoadingContainers(true);
    fetch(`${API}/teams/${teamId}/containers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (Array.isArray(c) && c.length > 0) setContainers(c); })
      .catch(() => {})
      .finally(() => setLoadingContainers(false));

    const sessionIds: string[] = JSON.parse(localStorage.getItem("comput3_sessions") ?? "[]");
    const recent = sessionIds.slice(0, 10);
    if (recent.length === 0) return;
    Promise.all(
      recent.map((id) =>
        fetch(`${API}/sessions/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      const real = results.filter(Boolean) as SessionSummary[];
      if (real.length > 0) setSessions(real);
    });
  }, []);

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
      <Sidebar active="Dashboard" />

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
                style={{ background: "#00BFFF", color: "#000000" }}
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
                <p className="text-2xl font-bold leading-tight flex items-center gap-2" style={{ color: s.accent ? "#00BFFF" : "#F9FAFB" }}>
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
                  const dotColor = s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#00BFFF";
                  const dotBg = s.state === "completed" ? "rgba(40,167,69,0.15)" : s.state === "failed" ? "rgba(220,53,69,0.15)" : "rgba(0,191,255,0.15)";
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
                        style={isActive ? { background: "#161618", border: "1px solid #00BFFF", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px" } : {}}
                      >
                        <p className="text-sm font-medium leading-snug" style={{ color: isActive ? "#00BFFF" : "#F3F4F6" }}>
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
                    <Link href="/deploy" className="text-xs mt-2 block" style={{ color: "#00BFFF" }}>Start your first deployment →</Link>
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
                      borderBottom: activeTab === tab ? "2px solid #00BFFF" : "2px solid transparent",
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
                          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                          </svg>
                        </div>
                      )}
                      {!loadingContainers && containers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                          <p className="text-sm" style={{ color: "#4B5563" }}>No containers running</p>
                          <Link href="/deploy" className="text-xs rounded-lg px-3 py-1.5 font-bold" style={{ background: "#00BFFF", color: "#000" }}>Deploy your first app →</Link>
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
                        <span style={{ color: s.state === "completed" ? "#28A745" : s.state === "failed" ? "#DC3545" : "#00BFFF" }}>
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
                          <Link href={`/verify/${s.id}`} className="text-xs mt-1 block" style={{ color: "#00BFFF" }} onClick={(e) => e.stopPropagation()}>
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
