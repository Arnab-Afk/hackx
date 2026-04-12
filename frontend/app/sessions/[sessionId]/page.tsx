"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { apiFetch, WS_API } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/AuthContext";

type SessionData = {
  id: string;
  team_id: string;
  prompt: string;
  state: "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
};

type ActionItem = {
  index: number;
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
  error?: string;
  timestamp: string;
  hash: string;
};

type ActionLog = {
  id: number;
  session_id: string;
  team_id: string;
  actions: ActionItem[];
  created_at: string;
};

type LiveEvent = {
  type: "message" | "action" | "plan" | "done" | "error";
  message?: string;
  action?: unknown;
  plan?: PlanData;
  container_id?: string;
  deployed_url?: string;
  error?: string;
};

type PlanContainer = {
  image: string;
  ports: string[];
  env: Record<string, string>;
};

type PlanData = {
  summary: string;
  containers: PlanContainer[];
  estimated_cost_usd?: number;
};

const toolIcons: Record<string, string> = {
  analyze_repo: "🔍",
  generate_deployment_plan: "📋",
  create_container: "📦",
  install_packages: "⬇️",
  configure_network: "🌐",
  setup_ide: "💻",
  setup_database: "🗄️",
  health_check: "💚",
  get_logs: "📜",
  destroy_container: "🗑️",
};

const toolColors: Record<string, string> = {
  analyze_repo: "#3b82f6",
  generate_deployment_plan: "#a78bfa",
  create_container: "#06b6d4",
  install_packages: "#f97316",
  configure_network: "#10b981",
  setup_ide: "#8b5cf6",
  setup_database: "#f59e0b",
  health_check: "#22c55e",
  get_logs: "#6b7280",
  destroy_container: "#ef4444",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { isAuthenticated, isConnected } = useAuth();
  const [session, setSession] = useState<SessionData | null>(null);
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [appURL, setAppURL] = useState("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const liveEndRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Don't fetch until auth is ready; keep loading=true only if wallet is connected
      // (auth is in progress), otherwise stop loading and show connect prompt.
      if (!isConnected) setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    async function load() {
      try {
        const sessRes = await apiFetch(`/sessions/${sessionId}`);
        if (!sessRes.ok) throw new Error(await sessRes.text());
        const sessData: SessionData = await sessRes.json();
        setSession(sessData);
        // Only fetch log when session is not running (log only exists after completion)
        if (sessData.state !== "running") {
          const logRes = await apiFetch(`/sessions/${sessionId}/log`);
          if (logRes.ok) {
            const rawLog = await logRes.json();
            setLog({
              ...rawLog,
              actions: typeof rawLog.actions === "string" ? JSON.parse(rawLog.actions) : rawLog.actions ?? [],
            });
          }
        }
        // If still running, connect WebSocket for live events
        if (sessData.state === "running") {
          connectStream(sessData.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isAuthenticated]);

  function scheduleReconnect(sid: string) {
    reconnectAttemptsRef.current += 1;
    // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30_000);
    setWsStatus("reconnecting");
    reconnectTimerRef.current = setTimeout(async () => {
      if (intentionalCloseRef.current) return;
      // Re-fetch session state — it may have completed while we were disconnected
      try {
        const res = await apiFetch(`/sessions/${sid}`);
        if (!res.ok) { setWsStatus("disconnected"); return; }
        const sessData: SessionData = await res.json();
        setSession(sessData);
        if (sessData.state === "running") {
          connectStream(sid);
        } else {
          // Session finished while disconnected — fetch log and show it
          setWsStatus("disconnected");
          const logRes = await apiFetch(`/sessions/${sid}/log`);
          if (logRes.ok) {
            const rawLog = await logRes.json();
            setLog({
              ...rawLog,
              actions: typeof rawLog.actions === "string" ? JSON.parse(rawLog.actions) : rawLog.actions ?? [],
            });
          }
        }
      } catch {
        setWsStatus("disconnected");
      }
    }, delay);
  }

  function connectStream(sid: string) {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_API}/sessions/${sid}/stream`);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsStatus("connected");
      reconnectAttemptsRef.current = 0;
    };
    ws.onmessage = (e) => {
      try {
        const evt: LiveEvent = JSON.parse(e.data);
        setLiveEvents((prev) => [...prev, evt]);
        if (evt.type === "plan") {
          setPlan(evt.plan ?? null);
        } else if (evt.type === "done") {
          if (evt.deployed_url) setAppURL(evt.deployed_url);
          else if (evt.container_id) setAppURL(`https://${evt.container_id}.deploy.comput3.xyz`);
          setSession((prev) => prev ? { ...prev, state: "completed" } : prev);
          intentionalCloseRef.current = true;
          ws.close();
          setWsStatus("disconnected");
          // Fetch log now that it exists
          apiFetch(`/sessions/${sid}/log`)
            .then((r) => (r.ok ? r.json() : null))
            .then((rawLog) => {
              if (rawLog) {
                setLog({
                  ...rawLog,
                  actions: typeof rawLog.actions === "string" ? JSON.parse(rawLog.actions) : rawLog.actions ?? [],
                });
              }
            })
            .catch(() => {});
        } else if (evt.type === "error") {
          setSession((prev) => prev ? { ...prev, state: "failed" } : prev);
          intentionalCloseRef.current = true;
          ws.close();
          setWsStatus("disconnected");
        }
        liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch {
        // ignore parse errors
      }
    };
    ws.onclose = () => {
      if (!intentionalCloseRef.current) {
        scheduleReconnect(sid);
      }
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  async function handleConfirm(approved: boolean) {
    setConfirming(true);
    try {
      await apiFetch(`/sessions/${sessionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ approved }),
      });
      if (!approved) {
        setSession((prev) => prev ? { ...prev, state: "failed" } : prev);
        wsRef.current?.close();
      }
    } finally {
      setConfirming(false);
      setPlan(null);
    }
  }

  function copyHash(hash: string, idx: number) {
    navigator.clipboard.writeText(hash);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  }

  function computeMerkleRoot(actions: ActionItem[]) {
    // Simple concatenated hash display — real Merkle root computed on-chain
    return actions.map((a) => a.hash).join("|").slice(0, 64) + "…";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#6b7280" }}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {isConnected && !isAuthenticated ? "Authenticating…" : "Loading session…"}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#6b7280" }}>
        <div className="text-center">
          <p className="font-bold mb-2" style={{ color: "#f3f4f6" }}>Wallet not connected</p>
          <p className="text-sm opacity-60 mb-4">Connect your wallet to view session details.</p>
          <Link href="/" className="text-sm underline" style={{ color: "#e2f0d9" }}>← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#f87171" }}>
        <div className="text-center">
          <p className="font-bold mb-2">Session not found</p>
          <p className="text-sm opacity-60 mb-4">{error}</p>
          <Link href="/" className="text-sm underline" style={{ color: "#e2f0d9" }}>← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const actions = log?.actions ?? [];
  const stateColor = session?.state === "completed" ? "#22c55e" : session?.state === "failed" ? "#ef4444" : "#eab308";

  return (
    <div className="min-h-screen flex" style={{ background: "#111111", color: "#d1d5db", fontFamily: "var(--font-inter), sans-serif" }}>
      <Sidebar mode="user" />
      <div className="flex-1">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1f2937" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70" style={{ color: "#6b7280" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Dashboard
          </Link>
          <span style={{ color: "#374151" }}>/</span>
          <span className="text-sm" style={{ color: "#6b7280" }}>Sessions</span>
          <span style={{ color: "#374151" }}>/</span>
          <span className="text-sm font-semibold" style={{ color: "#f3f4f6", fontFamily: "var(--font-space-mono), monospace" }}>
            {sessionId.slice(0, 20)}…
          </span>
        </div>
        <Link
          href="/deploy"
          className="text-xs px-4 py-1.5 rounded-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "#e2f0d9", color: "#111111" }}
        >
          New Deploy
        </Link>
      </header>


      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Session header */}
        <div className="rounded-sm p-6 mb-6" style={{ background: "#181818", border: "1px solid #1f2937" }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }}
                />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: stateColor }}>
                  {session?.state}
                </span>
              </div>
              <p className="text-base font-medium" style={{ color: "#f3f4f6" }}>{session?.prompt}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs mb-1" style={{ color: "#4b5563" }}>Started</div>
              <div className="text-xs font-mono" style={{ color: "#6b7280" }}>{session ? formatTime(session.created_at) : "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4" style={{ borderTop: "1px solid #1f2937" }}>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Session ID</div>
              <div className="text-xs font-mono truncate" style={{ color: "#6b7280" }}>{session?.id}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Team ID</div>
              <div className="text-xs font-mono truncate" style={{ color: "#6b7280" }}>{session?.team_id}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Actions</div>
              <div className="text-sm font-bold" style={{ color: "#f3f4f6" }}>{actions.length}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Duration</div>
              <div className="text-sm font-bold" style={{ color: "#f3f4f6" }}>
                {session ? formatDuration(session.created_at, session.updated_at) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Merkle / on-chain proof banner */}
        {actions.length > 0 && (
          <div
            className="rounded-sm p-4 mb-6 flex items-center gap-3"
            style={{ background: "#181818", border: "1px solid #1f2937" }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>🔏</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "#5c6e8c" }}>On-Chain Audit Root</div>
              <div className="text-xs font-mono truncate" style={{ color: "#4b5563" }}>{computeMerkleRoot(actions)}</div>
            </div>
            <a
              href={`https://base.easscan.org/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1 rounded-sm shrink-0 transition-opacity hover:opacity-80"
              style={{ background: "#1f2937", color: "#5c6e8c" }}
            >
              Verify on EAS →
            </a>
          </div>
        )}

        {/* App URL banner (if done) */}
        {appURL && (
          <div
            className="rounded-sm p-4 mb-6 flex items-center gap-3"
            style={{ background: "#0a1a0a", border: "1px solid #14532d" }}
          >
            <span style={{ fontSize: 16 }}>🚀</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "#22c55e" }}>App Deployed</div>
              <a
                href={appURL}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono truncate hover:underline"
                style={{ color: "#4ade80" }}
              >
                {appURL}
              </a>
            </div>
            <a
              href={appURL}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1 rounded-sm shrink-0 transition-opacity hover:opacity-80"
              style={{ background: "#14532d", color: "#4ade80" }}
            >
              Open App ↗
            </a>
          </div>
        )}

        {/* Plan confirmation panel */}
        {plan && (
          <div
            className="rounded-sm p-5 mb-6"
            style={{ background: "#0c0f1a", border: "1px solid #1e3a5f" }}
          >
            <p className="text-sm font-bold mb-3" style={{ color: "#93c5fd" }}>
              📋 Agent Deployment Plan — Awaiting Approval
            </p>
            <p className="text-xs mb-4" style={{ color: "#6b7280" }}>{plan.summary}</p>
            <div className="space-y-2 mb-4">
              {plan.containers?.map((c, i) => (
                <div
                  key={i}
                  className="rounded-sm p-3"
                  style={{ background: "#111827", border: "1px solid #1f2937" }}
                >
                  <p className="text-xs font-semibold font-mono mb-1" style={{ color: "#93c5fd" }}>
                    {c.image}
                  </p>
                  {c.ports?.length > 0 && (
                    <p className="text-xs" style={{ color: "#4b5563" }}>
                      Ports: {c.ports.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {plan.estimated_cost_usd != null && (
              <p className="text-xs mb-4" style={{ color: "#6b7280" }}>
                Estimated cost: <span style={{ color: "#f3f4f6", fontWeight: 700 }}>${plan.estimated_cost_usd.toFixed(4)} USDC</span>
              </p>
            )}
            <div className="flex gap-3">
              <button
                disabled={confirming}
                onClick={() => handleConfirm(true)}
                className="text-xs px-4 py-2 rounded-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "#e2f0d9", color: "#111111" }}
              >
                {confirming ? "Approving…" : "✓ Approve & Deploy"}
              </button>
              <button
                disabled={confirming}
                onClick={() => handleConfirm(false)}
                className="text-xs px-4 py-2 rounded-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "#1f2937", color: "#9ca3af" }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live event stream */}
        {(liveEvents.length > 0 || session?.state === "running") && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4b5563" }}>
                Live Stream — {liveEvents.length} events
              </h2>
              {session?.state === "running" && (
                <span
                  className="text-xs px-2 py-0.5 rounded-sm font-semibold"
                  style={{
                    background:
                      wsStatus === "connected" ? "#052e16" :
                      wsStatus === "connecting" ? "#1c1917" :
                      wsStatus === "reconnecting" ? "#1c0a00" : "#1f1315",
                    color:
                      wsStatus === "connected" ? "#4ade80" :
                      wsStatus === "connecting" ? "#a8a29e" :
                      wsStatus === "reconnecting" ? "#fb923c" : "#f87171",
                    border: `1px solid ${
                      wsStatus === "connected" ? "#14532d" :
                      wsStatus === "connecting" ? "#292524" :
                      wsStatus === "reconnecting" ? "#7c2d12" : "#450a0a"
                    }`,
                  }}
                >
                  {wsStatus === "connected" && "● live"}
                  {wsStatus === "connecting" && "◌ connecting…"}
                  {wsStatus === "reconnecting" && `↻ reconnecting… (attempt ${reconnectAttemptsRef.current})`}
                  {wsStatus === "disconnected" && "○ disconnected"}
                </span>
              )}
            </div>
            <div
              className="rounded-sm overflow-y-auto"
              style={{
                background: "#0a0a0a",
                border: "1px solid #1f2937",
                maxHeight: 256,
                padding: 12,
              }}
            >
              {liveEvents.map((evt, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{
                      color:
                        evt.type === "error"
                          ? "#ef4444"
                          : evt.type === "done"
                          ? "#22c55e"
                          : evt.type === "plan"
                          ? "#93c5fd"
                          : "#6b7280",
                      width: 56,
                    }}
                  >
                    [{evt.type}]
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#9ca3af" }}>
                    {evt.type === "message" && (typeof evt.message === "string" ? evt.message : JSON.stringify(evt.message))}
                    {evt.type === "action" && JSON.stringify(evt.action).slice(0, 120)}
                    {evt.type === "plan" && (evt.plan?.summary ?? JSON.stringify(evt.plan).slice(0, 120))}
                    {evt.type === "done" && (evt.deployed_url ?? evt.container_id ?? "done")}
                    {evt.type === "error" && (typeof evt.error === "string" ? evt.error : "error")}
                  </span>
                </div>
              ))}
              <div ref={liveEndRef} />
            </div>
          </div>
        )}

        {/* Action log */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#4b5563" }}>
            Action Log — {actions.length} tool calls
          </h2>

          {actions.length === 0 && (
            <div className="rounded-sm p-8 text-center" style={{ background: "#181818", border: "1px solid #1f2937" }}>
              <p className="text-sm" style={{ color: "#4b5563" }}>
                {session?.state === "running" ? "Session is still running…" : "No actions recorded."}
              </p>
            </div>
          )}

          <div className="relative">
            {/* vertical line */}
            {actions.length > 0 && (
              <div
                className="absolute left-5 top-0 bottom-0 w-px"
                style={{ background: "linear-gradient(to bottom, #1f2937, transparent)" }}
              />
            )}

            <div className="space-y-3">
              {actions.map((action, i) => {
                const color = toolColors[action.tool] ?? "#6b7280";
                const icon = toolIcons[action.tool] ?? "⚙️";
                const isExpanded = expanded[i];
                const hasError = !!action.error;

                return (
                  <div key={i} className="relative pl-12">
                    {/* timeline dot */}
                    <div
                      className="absolute left-3.5 top-4 w-3 h-3 rounded-sm border-2"
                      style={{
                        background: hasError ? "#7f1d1d" : "#0e0e0e",
                        borderColor: hasError ? "#ef4444" : color,
                        boxShadow: hasError ? "0 0 6px #ef444466" : `0 0 6px ${color}44`,
                      }}
                    />

                    <div
                      className="rounded-sm overflow-hidden"
                      style={{
                        background: "#181818",
                        border: `1px solid ${hasError ? "#7f1d1d" : "#1f2937"}`,
                      }}
                    >
                      {/* header row */}
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/2"
                      >
                        <span className="text-base">{icon}</span>
                        <span
                          className="text-xs font-semibold font-mono"
                          style={{ color, fontFamily: "var(--font-space-mono), monospace" }}
                        >
                          {action.tool}
                        </span>
                        <span className="text-xs" style={{ color: "#4b5563" }}>
                          #{action.index}
                        </span>
                        <span className="ml-auto text-xs" style={{ color: "#374151" }}>
                          {formatTime(action.timestamp)}
                        </span>
                        {hasError ? (
                          <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>✗ error</span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>✓</span>
                        )}
                        <svg
                          xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="transition-transform"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #1f2937" }}>
                          {/* Input */}
                          <div className="pt-3">
                            <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "#4b5563" }}>Input</div>
                            <pre
                              className="text-xs p-3 rounded-lg overflow-x-auto"
                              style={{
                                background: "#0a0a0a",
                                color: "#9ca3af",
                                fontFamily: "var(--font-space-mono), monospace",
                                lineHeight: 1.6,
                              }}
                            >
                              {JSON.stringify(action.input, null, 2)}
                            </pre>
                          </div>

                          {/* Result / Error */}
                          {(action.result !== undefined || action.error) && (
                            <div>
                              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: hasError ? "#7f1d1d" : "#4b5563" }}>
                                {hasError ? "Error" : "Result"}
                              </div>
                              <pre
                                className="text-xs p-3 rounded-lg overflow-x-auto"
                                style={{
                                  background: hasError ? "#1a0a0a" : "#0a0a0a",
                                  color: hasError ? "#fca5a5" : "#6b7280",
                                  fontFamily: "var(--font-space-mono), monospace",
                                  lineHeight: 1.6,
                                }}
                              >
                                {action.error ?? JSON.stringify(action.result, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Hash */}
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#374151" }}>Action Hash</div>
                              <code className="text-xs" style={{ color: "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
                                {action.hash}
                              </code>
                            </div>
                            <button
                              onClick={() => copyHash(action.hash, i)}
                              className="text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
                              style={{ background: "#1f2937", color: "#6b7280" }}
                            >
                              {copied === i ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-10 pt-6 flex items-center justify-between" style={{ borderTop: "1px solid #1f2937" }}>
          <Link href="/" className="text-xs hover:underline" style={{ color: "#4b5563" }}>← Dashboard</Link>
          <Link href="/deploy" className="text-xs hover:underline" style={{ color: "#e2f0d9" }}>Deploy Again →</Link>
        </div>
      </div>
      </div>
    </div>
  );
}
