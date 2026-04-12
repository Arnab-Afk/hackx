"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { useBalance } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { MoreHorizontal, ChevronUp, ChevronDown } from "lucide-react";

type Container = {
  ID: string;
  Name: string;
  Image?: string;
  Status: string;
  Ports: Record<string, string> | null;
  Created?: string;
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
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}
export default function Home() {
  const { address, isAuthenticated, isConnected, teamId, teamName, isNewAccount, hydrated } = useAuth();
  const router = useRouter();
  const { data: balance } = useBalance({ address: address as `0x${string}` | undefined, chainId: baseSepolia.id });
  const clock = useClock();
  const [containers, setContainers] = useState<Container[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);

  // Auth guard — redirect to /signin if not authenticated
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [hydrated, isAuthenticated, router]);
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
  const running = containers.filter((c) => c.Status?.toLowerCase() === "running").length;
  const completed = sessions.filter((s) => s.state === "completed").length;
  const successRate = sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0;
  const seedBars = [40, 60, 45, 70, 85, 95, 80, 65];
  const containerBars = seedBars.map((v, i) => containers.length > 0 ? Math.max(20, running * 10 + i * 5) : v);
  const sessionBars = [30, 40, 50, 45, 55, 60, 50, 40].map((v, i) => sessions.length > 0 ? Math.max(15, (sessions.length % 8) * 10 + i * 3) : v);
  const computeBars = [50, 45, 60, 55, 80, 90, 100, 95].map((v, i) => sessions.length > 0 ? Math.min(100, successRate + i * 3) : v);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => ({
    day,
    val: sessions.filter((_, si) => si % 7 === i).length,
  }));
  const todayIdx = (new Date().getDay() + 6) % 7;
  const maxDay = Math.max(...days.map((d) => d.val), 1);

  // Blank screen while resolving auth / redirecting
  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111" }}>
        <span className="inline-block h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: "#111111", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#f9fafb" }}>
      <Sidebar mode="user" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-8 py-8 flex flex-col gap-6">

          {/* ── Header ── */}
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-light tracking-tight">Overview</h1>
            <div className="flex items-center gap-4">
              <div className="text-xl font-light tracking-tight">
                {clock} <span className="text-[11px] text-gray-500 ml-1 uppercase tracking-wider">Time</span>
              </div>
              <WalletButton />
              <Link
                href="/deploy"
                className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "#e2f0d9", color: "#111111", textDecoration: "none" }}
              >
                Deploy
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>
          </header>

          {/* ── Onboarding banner ── */}
          {isNewAccount && (
            <Link
              href="/onboarding"
              className="flex items-center justify-between rounded-2xl px-5 py-4"
              style={{ background: "rgba(226,240,217,0.06)", border: "1px solid rgba(226,240,217,0.18)", textDecoration: "none" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(226,240,217,0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2f0d9" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {teamName && !teamName.startsWith("account-") ? `Welcome, ${teamName}` : "Set up your account"}
                  </p>
                  <p className="text-xs text-gray-500">Add a display name to personalize your workspace.</p>
                </div>
              </div>
              <span className="text-xs font-medium" style={{ color: "#e2f0d9" }}>Set up →</span>
            </Link>
          )}

          {/* ── Stat strip ── */}
          <div className="grid grid-cols-4 gap-4">
            {/* Containers */}
            <div className="rounded-2xl p-6 border border-white/5 flex flex-col gap-4" style={{ background: "#1a1a1a" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Containers</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${running > 0 ? "bg-green-400" : "bg-gray-600"}`} />
                  <span className="text-[10px] text-gray-600">{running > 0 ? "Live" : "Idle"}</span>
                </div>
              </div>
              <div>
                <div className="text-4xl font-light tracking-tight">
                  {running}<span className="text-2xl text-gray-600">/{containers.length}</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">running / total</div>
              </div>
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${containers.length > 0 ? Math.round((running / containers.length) * 100) : 0}%`, background: "#e2f0d9" }} />
              </div>
            </div>

            {/* Pipelines */}
            <div className="rounded-2xl p-6 border border-white/5 flex flex-col gap-4" style={{ background: "#1a1a1a" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Pipelines</span>
                <Link href="/sessions" className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors" style={{ textDecoration: "none" }}>View all →</Link>
              </div>
              <div>
                <div className="text-4xl font-light tracking-tight">
                  {completed}<span className="text-2xl text-gray-600">/{sessions.length}</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">completed / total</div>
              </div>
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0}%`, background: "rgba(255,255,255,0.3)" }} />
              </div>
            </div>

            {/* Success rate */}
            <div className="rounded-2xl p-6 border border-white/5 flex flex-col gap-4" style={{ background: "#1a1a1a" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Success Rate</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border"
                  style={{
                    color: successRate >= 80 ? "#22c55e" : successRate >= 50 ? "#f59e0b" : "#4b5563",
                    borderColor: successRate >= 80 ? "#22c55e44" : successRate >= 50 ? "#f59e0b44" : "#4b556344",
                  }}
                >
                  {successRate >= 80 ? "Healthy" : successRate >= 50 ? "Fair" : "—"}
                </span>
              </div>
              <div>
                <div className="text-4xl font-light tracking-tight">
                  {successRate}<span className="text-2xl text-gray-600">%</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">{completed} of {sessions.length} succeeded</div>
              </div>
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${successRate}%`, background: successRate >= 80 ? "#22c55e" : successRate >= 50 ? "#f59e0b" : "rgba(255,255,255,0.2)" }} />
              </div>
            </div>

            {/* Balance */}
            <div className="rounded-2xl p-6 flex flex-col gap-3 text-black" style={{ background: "#e2f0d9" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-50 uppercase tracking-wider">Wallet Balance</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,0,0,0.08)" }}>
                  Base Sepolia
                </span>
              </div>
              <div>
                <div className="text-4xl font-light tracking-tight">
                  {balance ? parseFloat(balance.formatted).toFixed(3) : (isConnected ? "…" : "—")}
                  <span className="text-lg opacity-40 ml-1.5">ETH</span>
                </div>
                <div className="text-[10px] opacity-50 mt-1 font-mono">
                  {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
                </div>
              </div>
              {isConnected && (!balance || parseFloat(balance.formatted) < 0.01) && (
                <a
                  href="https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold opacity-50 hover:opacity-100 transition-opacity"
                  style={{ textDecoration: "none", marginTop: "auto" }}
                >
                  Get testnet ETH →
                </a>
              )}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-12 gap-5">

            {/* Resource Activity — 7 cols */}
            <div className="col-span-12 lg:col-span-7 rounded-3xl p-8 border border-white/5" style={{ background: "#1a1a1a" }}>
              <div className="flex justify-between items-start mb-10">
                <h2 className="text-xl font-light">Resource activity</h2>
                <Link
                  href="/deploy"
                  className="px-4 py-1.5 rounded-full border border-white/10 text-xs text-gray-400 hover:bg-white/5 transition-colors"
                  style={{ textDecoration: "none" }}
                >
                  New pipeline
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className="flex items-center gap-1">Containers <ChevronUp size={12} /></span>
                    <MoreHorizontal size={14} className="cursor-pointer" />
                  </div>
                  <div className="h-28 flex items-end gap-1 px-2">
                    {containerBars.map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: "rgba(255,255,255,0.2)" }} />
                    ))}
                  </div>
                  <div>
                    <div className="text-4xl font-light">{running}–{containers.length}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">running / total</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className="flex items-center gap-1">Pipelines <ChevronDown size={12} /></span>
                    <MoreHorizontal size={14} className="cursor-pointer" />
                  </div>
                  <div className="h-28 flex items-end gap-1 px-2">
                    {sessionBars.map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: "rgba(255,255,255,0.4)" }} />
                    ))}
                  </div>
                  <div>
                    <div className="text-4xl font-light">{completed}–{sessions.length}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">done / total</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className="flex items-center gap-1">Compute <ChevronDown size={12} /></span>
                    <MoreHorizontal size={14} className="cursor-pointer" />
                  </div>
                  <div className="h-28 flex items-end gap-1 px-2">
                    {computeBars.map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm bg-white" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div>
                    <div className="text-4xl font-light">{successRate}%</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">success rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workspaces — 5 cols */}
            <div className="col-span-12 lg:col-span-5 rounded-3xl p-8 border border-white/5 flex flex-col" style={{ background: "#1a1a1a" }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-light">Workspaces</h2>
                  <p className="text-xs text-gray-500 mt-1">Network · <span className="text-gray-300">Base Sepolia</span></p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] text-gray-500">Online</span>
                </div>
              </div>

              <div className="flex-1 w-full relative my-4" style={{ minHeight: 110 }}>
                <svg viewBox="0 0 300 130" className="w-full h-full" style={{ opacity: 0.45 }}>
                  <path d="M50,110 L220,110 L260,75 L90,75 Z" fill="none" stroke="#e2f0d9" strokeWidth="0.6" />
                  <path d="M50,110 L50,38 L90,8 L260,8 L260,75" fill="none" stroke="#e2f0d9" strokeWidth="0.6" />
                  <line x1="220" y1="110" x2="220" y2="38" stroke="#e2f0d9" strokeWidth="0.6" />
                  <line x1="260" y1="8" x2="220" y2="38" stroke="#e2f0d9" strokeWidth="0.6" />
                  <line x1="90" y1="75" x2="90" y2="8" stroke="#e2f0d9" strokeWidth="0.6" />
                  <rect x="118" y="38" width="72" height="32" fill="none" stroke="#e2f0d9" strokeWidth="0.5" rx="2" />
                  <rect x="120" y="40" width="68" height="28" fill="#e2f0d9" fillOpacity="0.07" rx="1" />
                  {running > 0 && <circle cx="154" cy="54" r="5" fill="#e2f0d9" opacity="0.8" />}
                  {running > 0 && <circle cx="154" cy="54" r="10" fill="none" stroke="#e2f0d9" strokeWidth="0.5" opacity="0.35" />}
                </svg>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, #1a1a1a 5%, transparent 55%)" }} />
              </div>

              <div className="mt-auto space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Running</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <div style={{ width: `${containers.length > 0 ? Math.round((running / containers.length) * 100) : 0}%`, height: "100%", background: "#e2f0d9" }} />
                    </div>
                    <span className="text-gray-300 font-medium w-4 text-right">{running}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Total containers</span>
                  <span className="text-gray-300 font-medium">{containers.length}</span>
                </div>
                <Link
                  href="/deploy"
                  className="flex items-center justify-center w-full py-2.5 rounded-xl text-xs font-medium border border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200 transition-all mt-1"
                  style={{ textDecoration: "none" }}
                >
                  + New workspace
                </Link>
              </div>
            </div>
          </div>

          {/* ── Second row ── */}
          <div className="grid grid-cols-12 gap-5">

            {/* Pipeline Report — 5 cols */}
            <div className="col-span-12 lg:col-span-5 rounded-3xl p-8 border border-white/5 flex flex-col" style={{ background: "#1a1a1a" }}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-light">Pipeline report</h2>
                <button className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase text-gray-500">
                  Week <ChevronDown size={9} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-6">Deployment activity by day</p>
              <div className="flex-1 flex items-end justify-between px-1 gap-1" style={{ minHeight: 120 }}>
                {days.map((d, i) => {
                  const barH = Math.max(6, Math.round((d.val / maxDay) * 100));
                  const isToday = i === todayIdx;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                      <div className="text-[9px] text-gray-600">{d.val}</div>
                      <div className="w-full">
                        <div
                          className="w-full rounded-sm transition-all duration-500"
                          style={{ height: `${barH}px`, background: isToday ? "#e2f0d9" : "rgba(255,255,255,0.1)" }}
                        />
                      </div>
                      <div className="text-[9px] text-gray-500">{d.day}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deployment Health — 7 cols */}
            <div className="col-span-12 lg:col-span-7 rounded-3xl p-8 text-black relative" style={{ background: "#e2f0d9" }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-medium tracking-tight">Deployment health</h2>
                  <p className="text-xs opacity-60 mt-1">Pipeline success &amp; failure rate</p>
                </div>
                <span className="text-[10px] font-medium opacity-40 uppercase tracking-wider mt-1">
                  {completed} of {sessions.length} succeeded
                </span>
              </div>
              <div className="flex items-end justify-between mt-6">
                <div className="text-7xl font-light tracking-tighter">{successRate}%</div>
                <div className="flex-1 max-w-xs pb-4 ml-10">
                  <div className="relative">
                    <div className="absolute h-px w-full top-4" style={{ background: "rgba(0,0,0,0.12)" }} />
                    <div className="flex justify-between relative z-10">
                      {["New","Queue","Run","Verify","Done"].map((label, i) => {
                        const filled = i < Math.ceil((successRate / 100) * 5);
                        return (
                          <div key={label} className="flex flex-col items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full border flex items-center justify-center"
                              style={{ background: filled ? "#111111" : "#e2f0d9", borderColor: "rgba(0,0,0,0.15)" }}
                            >
                              {!filled && <div className="w-1.5 h-1.5 rounded-full border border-black/30" />}
                            </div>
                            <span className="text-[9px] font-medium uppercase">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              {sessions.length > 0 ? (
                <div className="mt-6 pt-5 border-t border-black/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-medium opacity-40 uppercase tracking-wider">Recent sessions</span>
                    <Link href="/sessions" className="text-[10px] font-semibold opacity-50 hover:opacity-100 transition-opacity" style={{ textDecoration: "none" }}>
                      View all →
                    </Link>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {sessions.slice(0, 5).map((s) => (
                      <Link
                        key={s.id}
                        href={`/sessions/${s.id}`}
                        className="shrink-0 flex flex-col gap-1 px-3 py-2 rounded-xl"
                        style={{ background: "rgba(0,0,0,0.07)", textDecoration: "none", minWidth: 140 }}
                      >
                        <span className="text-[10px] font-mono truncate" style={{ color: "rgba(0,0,0,0.4)" }}>{s.id.slice(0, 8)}…</span>
                        <span className="text-[11px] font-medium truncate" style={{ color: "rgba(0,0,0,0.75)" }}>
                          {s.prompt.slice(0, 28)}{s.prompt.length > 28 ? "…" : ""}
                        </span>
                        <span className="text-[10px] font-semibold"
                          style={{ color: s.state === "completed" ? "#15803d" : s.state === "failed" ? "#b91c1c" : "#b45309" }}>
                          {s.state}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 pt-5 border-t border-black/10 flex items-center justify-between">
                  <p className="text-xs opacity-50">No deployments yet</p>
                  <Link
                    href="/deploy"
                    className="text-xs font-semibold px-4 py-2 rounded-full"
                    style={{ background: "#111111", color: "#e2f0d9", textDecoration: "none" }}
                  >
                    Start deploying →
                  </Link>
                </div>
              )}
            </div>

          </div>

          {/* ── Quick-action row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "New Deployment", href: "/deploy", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> },
              { label: "Manage Secrets", href: "/secrets", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l2 2"/></svg> },
              { label: "Attestations",   href: "/attestations", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { label: "Payments",       href: "/payments", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
            ].map(({ label, href, icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-light border border-white/5 hover:border-white/10 transition-all"
                style={{ background: "#1a1a1a", color: "#6b7280", textDecoration: "none" }}
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
