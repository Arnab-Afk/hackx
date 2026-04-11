"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
  const [session, setSession] = useState<SessionData | null>(null);
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, logRes] = await Promise.all([
          fetch(`${API}/sessions/${sessionId}`),
          fetch(`${API}/sessions/${sessionId}/log`),
        ]);
        if (!sessRes.ok) throw new Error("Session not found");
        setSession(await sessRes.json());
        if (logRes.ok) {
          const rawLog = await logRes.json();
          // actions field is raw bytes/JSON from backend
          setLog({
            ...rawLog,
            actions: typeof rawLog.actions === "string" ? JSON.parse(rawLog.actions) : rawLog.actions ?? [],
          });
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0e0e0e", color: "#6b7280" }}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading session…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0e0e0e", color: "#f87171" }}>
        <div className="text-center">
          <p className="font-bold mb-2">Session not found</p>
          <p className="text-sm opacity-60 mb-4">{error}</p>
          <Link href="/" className="text-sm underline" style={{ color: "#5c6e8c" }}>← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const actions = log?.actions ?? [];
  const stateColor = session?.state === "completed" ? "#22c55e" : session?.state === "failed" ? "#ef4444" : "#eab308";

  return (
    <div className="min-h-screen" style={{ background: "#0e0e0e", color: "#d1d5db", fontFamily: "var(--font-inter), sans-serif" }}>
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
          className="text-xs px-4 py-1.5 rounded-full font-semibold transition-opacity hover:opacity-80"
          style={{ background: "linear-gradient(135deg, #5c6e8c, #3b82f6)", color: "#fff" }}
        >
          New Deploy
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Session header */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: "#151515", border: "1px solid #1f2937" }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
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
            className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{ background: "#0d0f1a", border: "1px solid #1e2a4a" }}
          >
            <span className="text-lg">🔏</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "#818cf8" }}>On-Chain Audit Root</div>
              <div className="text-xs font-mono truncate" style={{ color: "#4b5563" }}>{computeMerkleRoot(actions)}</div>
            </div>
            <a
              href={`https://base.easscan.org/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1 rounded-lg shrink-0 transition-opacity hover:opacity-80"
              style={{ background: "#1e2a4a", color: "#818cf8" }}
            >
              Verify on EAS →
            </a>
          </div>
        )}

        {/* Action log */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#4b5563" }}>
            Action Log — {actions.length} tool calls
          </h2>

          {actions.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "#151515", border: "1px solid #1f2937" }}>
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
                      className="absolute left-3.5 top-4 w-3 h-3 rounded-full border-2"
                      style={{
                        background: hasError ? "#7f1d1d" : "#0e0e0e",
                        borderColor: hasError ? "#ef4444" : color,
                        boxShadow: hasError ? "0 0 6px #ef444466" : `0 0 6px ${color}44`,
                      }}
                    />

                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "#151515",
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
          <Link href="/deploy" className="text-xs hover:underline" style={{ color: "#5c6e8c" }}>Deploy Again →</Link>
        </div>
      </div>
    </div>
  );
}
