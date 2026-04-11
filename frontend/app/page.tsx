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

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: baseSepolia.id });

  const [containers, setContainers] = useState<Container[]>(MOCK_CONTAINERS);
  const [sessions, setSessions] = useState<SessionSummary[]>(MOCK_SESSIONS);
  const [loadingContainers, setLoadingContainers] = useState(false);

  useEffect(() => {
    const teamId = localStorage.getItem("zkloud_team_id");
    if (!teamId) return; // keep mock data if no backend session

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
  return (
    <div
      className="min-h-screen p-6 overflow-hidden"
      style={{
        background: "#0e0e0e",
        color: "#d1d5db",
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      {/* Top Header */}
      <header
        className="flex justify-between items-center mb-6 pb-4"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold tracking-tight" style={{ fontSize: "15px" }}>
              Zkloud
            </span>
          </div>
          <nav className="flex gap-6" style={{ fontSize: "13px" }}>
            {["Dashboard", "Deploy", "Verify", "Docs"].map((item, i) => (
              item === "Deploy" ? (
                <Link
                  key={item}
                  href="/deploy"
                  className="cursor-pointer transition-colors"
                  style={{ color: "#6b7280" }}
                >
                  {item}
                </Link>
              ) : (
                <span
                  key={item}
                  className="cursor-pointer transition-colors"
                  style={{ color: i === 0 ? "#ffffff" : "#6b7280" }}
                >
                  {item}
                </span>
              )
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Network status */}
          <div className="flex items-center gap-2" style={{ fontSize: "12px", color: "#6b7280" }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
              <span>Base Mainnet</span>
            </div>
            <span style={{ color: "#374151" }}>·</span>
            <span>3 providers online</span>
          </div>

          <WalletButton />
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 110px)" }}>

        {/* ── Column 1: Deploy + Workspaces ── */}
        <div className="flex flex-col gap-4" style={{ width: "25%" }}>

          {/* Quick Deploy CTA — blue */}
          <div
            className="p-5 flex flex-col justify-center rounded-sm"
            style={{ background: "#5c6e8c", color: "#ffffff", height: "28%" }}
          >
            <Link
              href="/deploy"
              className="w-full rounded-sm py-3 font-semibold transition-opacity text-sm text-center block"
              style={{ background: "#ffffff", color: "#1e2d3d", fontSize: "13px" }}
            >
              Start deploying →
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex gap-3" style={{ height: "14%" }}>
            <div
              className="flex-1 p-4 rounded-sm flex flex-col justify-between"
              style={{ background: "#181818" }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>Running</p>
              <span className="text-white font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "1.75rem" }}>{running}</span>
            </div>
            <div
              className="flex-1 p-4 rounded-sm flex flex-col justify-between"
              style={{ background: "#181818" }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>Stopped</p>
              <span className="font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "1.75rem", color: "#6b7280" }}>{stopped}</span>
            </div>
          </div>

          {/* Workspaces */}
          <div
            className="p-4 flex flex-col flex-1 rounded-sm"
            style={{ background: "#181818", overflow: "hidden" }}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>
                My workspaces
              </p>
              <span className="text-xs cursor-pointer" style={{ color: "#5c6e8c", fontSize: "11px" }}>View all</span>
            </div>
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
              {loadingContainers && (
                <p className="text-xs text-center py-4" style={{ color: "#4b5563" }}>Loading…</p>
              )}
              {!loadingContainers && containers.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "#374151" }}>No containers yet. Deploy something!</p>
              )}
              {containers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-sm cursor-pointer hover:bg-[#222222] transition-colors"
                  style={{ background: "#1e1e1e" }}
                >
                  <div
                    className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: "#2a2a2a", color: c.status === "running" ? "#5c6e8c" : "#4b5563" }}
                  >
                    📦
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate" style={{ fontSize: "12px" }}>{c.name}</p>
                    <p className="truncate" style={{ fontSize: "10px", color: "#6b7280" }}>{c.image}</p>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: c.status === "running" ? "#22c55e" : "#4b5563" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Column 2: Credits + Feature card ── */}
        <div className="flex flex-col gap-4" style={{ width: "22%" }}>

          {/* Wallet & Fund Agent */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#181818", height: "32%" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#6b7280", fontSize: "10px" }}>
                Agent Wallet
              </p>
              {isConnected && address ? (
                <div className="mt-3">
                  <div className="text-xs font-mono truncate mb-1" style={{ color: "#4b5563" }}>
                    {address.slice(0, 10)}…{address.slice(-6)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "2rem", letterSpacing: "-0.03em" }}>
                      {balance ? parseFloat(balance.formatted).toFixed(4) : "—"}
                    </span>
                    <span style={{ color: "#6b7280", fontSize: "12px" }}>ETH</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#4b5563" }}>Base Sepolia</div>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm" style={{ color: "#4b5563" }}>Connect wallet to fund the agent escrow</p>
                </div>
              )}
            </div>
            <div>
              <a
                href={`https://sepolia.basescan.org/address/0x5f4eb5a650Cc01c93e1c6A94a06d7551b6b35E76`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 w-full rounded-sm px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#5c6e8c", color: "#fff" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
                </svg>
                Fund Escrow Contract
              </a>
              <p className="mt-2" style={{ fontSize: "10px", color: "#374151" }}>DeploymentEscrow on Base Sepolia</p>
            </div>
          </div>

          {/* Feature card */}
          <div
            className="p-6 flex flex-col justify-end flex-1 rounded-sm relative overflow-hidden"
            style={{ background: "#5c6e8c", color: "#ffffff" }}
          >
            <svg
              className="absolute top-0 right-0 pointer-events-none"
              style={{ width: "100%", height: "55%", opacity: 0.3 }}
              viewBox="0 0 200 200"
            >
              <path d="M 100 0 L 100 200 M 0 100 L 200 100" stroke="white" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" fill="none" />
              <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="0.5" fill="none" />
              <path d="M 20 20 L 180 180" stroke="white" strokeWidth="0.5" />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px" }}>
              How it works
            </p>
            <h3 className="font-semibold leading-snug mb-3" style={{ fontSize: "16px" }}>
              Trustless by design. Verifiable by anyone.
            </h3>
            <p className="leading-relaxed mb-5" style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>
              Every agent action is hashed and recorded on-chain. Your keys never leave your browser. Not even we can read your containers.
            </p>
            <a className="text-xs font-semibold underline cursor-pointer" style={{ color: "rgba(255,255,255,0.85)", fontSize: "11px" }}>
              Read the attestation docs →
            </a>
          </div>
        </div>

        {/* ── Column 3 & 4: Active deployments + attestations ── */}
        <div className="flex flex-col gap-4 flex-1">

          {/* Active Deployments table */}
          <div
            className="p-5 rounded-sm flex flex-col"
            style={{ background: "#181818", flex: "1 1 55%" }}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-semibold" style={{ fontSize: "14px" }}>Active Deployments</h3>
                <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{containers.length} containers · {running} running</p>
              </div>
              <Link
                href="/deploy"
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-white transition-opacity"
                style={{ background: "#5c6e8c", fontSize: "12px" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                New deployment
              </Link>
            </div>

            {/* Table header */}
            <div
              className="grid gap-4 pb-2 mb-1"
              style={{
                gridTemplateColumns: "1fr 1fr 80px 80px 100px 28px",
                fontSize: "10px",
                color: "#4b5563",
                borderBottom: "1px solid #1f2937",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span>Environment</span>
              <span>Stack</span>
              <span>Cloud</span>
              <span>Uptime</span>
              <span>Attestation</span>
              <span />
            </div>

            {/* Rows */}
            <div className="flex flex-col flex-1 overflow-y-auto">
              {containers.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center py-8">
                    <p className="text-sm mb-3" style={{ color: "#4b5563" }}>No containers running</p>
                    <Link href="/deploy" className="text-xs px-3 py-1.5 rounded-sm" style={{ background: "#5c6e8c", color: "#fff" }}>Deploy your first app →</Link>
                  </div>
                </div>
              )}
              {containers.map((c) => (
                <div
                  key={c.id}
                  className="grid gap-4 py-3 hover:bg-[#1e1e1e] transition-colors rounded-sm cursor-pointer"
                  style={{
                    gridTemplateColumns: "1fr 1fr 80px 80px 100px 28px",
                    borderBottom: "1px solid #161616",
                    alignItems: "center",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: c.status === "running" ? "#22c55e" : "#4b5563" }}
                    />
                    <span className="text-white font-medium truncate" style={{ fontSize: "13px" }}>{c.name}</span>
                  </div>
                  <span className="truncate font-mono" style={{ fontSize: "11px", color: "#9ca3af" }}>{c.image}</span>
                  <span
                    className="inline-flex items-center rounded-sm px-1.5 py-0.5"
                    style={{ fontSize: "10px", color: "#9ca3af", background: "#222", width: "fit-content", fontFamily: "var(--font-space-mono), monospace" }}
                  >
                    docker
                  </span>
                  <span style={{ fontSize: "12px", color: c.status === "running" ? "#d1d5db" : "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
                    {c.status === "running" ? "live" : "stopped"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span style={{ fontSize: "11px", color: "#f59e0b" }}>Pending</span>
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex gap-4" style={{ flex: "0 0 auto", height: "42%" }}>

            {/* On-chain attestations */}
            <div
              className="p-5 rounded-sm flex flex-col"
              style={{ background: "#181818", width: "55%" }}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-semibold" style={{ fontSize: "14px" }}>On-Chain Attestations</h3>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Tamper-proof audit trail on Base</p>
                </div>
                <span className="text-xs cursor-pointer" style={{ color: "#5c6e8c", fontSize: "11px" }}>BaseScan →</span>
              </div>
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {sessions.length === 0 && (
                  <p className="text-xs text-center py-6" style={{ color: "#374151" }}>No sessions yet. Attestations will appear here after deployment.</p>
                )}
                {sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    className="flex items-center justify-between p-2.5 rounded-sm cursor-pointer hover:bg-[#222] transition-colors"
                    style={{ background: "#1e1e1e", textDecoration: "none" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-6 h-6 rounded-sm flex items-center justify-center shrink-0"
                        style={{ background: "#222" }}
                      >
                        {s.state === "completed" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : s.state === "failed" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : (
                          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="4" />
                            <path className="opacity-75" fill="#f59e0b" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white truncate" style={{ fontSize: "12px" }}>{s.prompt.slice(0, 50)}{s.prompt.length > 50 ? "…" : ""}</p>
                        <p className="truncate" style={{ fontSize: "10px", color: "#6b7280" }}>
                          <span style={{ fontFamily: "var(--font-space-mono), monospace" }}>{s.id.slice(0, 12)}…</span>
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-3 text-right">
                      <div
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ color: s.state === "completed" ? "#22c55e" : s.state === "failed" ? "#ef4444" : "#f59e0b", fontSize: "9px", background: "#222" }}
                      >
                        {s.state.toUpperCase()}
                      </div>
                      <Link
                        href={`/verify/${s.id}`}
                        className="text-xs mt-1 block hover:underline"
                        style={{ color: "#5c6e8c", fontSize: "9px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        verify →
                      </Link>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Resource usage + IaC link */}
            <div className="flex flex-col gap-4 flex-1">

              {/* Resource overview */}
              <div
                className="p-5 rounded-sm flex-1"
                style={{ background: "#181818" }}
              >
                <h3 className="text-white font-semibold mb-4" style={{ fontSize: "13px" }}>Resource Usage</h3>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Compute", value: "1.59 TB", pct: 60 },
                    { label: "API calls", value: "5.01 / $18", pct: 28 },
                  ].map((r) => (
                    <div key={r.label}>
                      <div className="flex justify-between mb-1" style={{ fontSize: "11px" }}>
                        <span style={{ color: "#9ca3af" }}>{r.label}</span>
                        <span className="text-white" style={{ fontFamily: "var(--font-space-mono), monospace" }}>{r.value}</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                        <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "#5c6e8c" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IaC Templates — tan */}
              <div
                className="p-5 rounded-sm flex justify-between items-end relative group cursor-pointer"
                style={{ background: "#c2c1b4", color: "#111111", flex: "0 0 auto", height: "42%" }}
              >
                <div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#181818", color: "#ffffff" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold leading-snug uppercase tracking-widest" style={{ fontSize: "13px", lineHeight: 1.15 }}>
                    IaC Pipeline<br />Templates
                  </p>
                  <p className="mt-1" style={{ fontSize: "10px", color: "#555" }}>Start from a verified template</p>
                </div>
                <span
                  className="font-bold uppercase tracking-widest"
                  style={{ fontSize: "10px", color: "#333", fontFamily: "var(--font-space-mono), monospace" }}
                >
                  10 / 20
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

