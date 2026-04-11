"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type EventItem =
  | { type: "message"; message: string }
  | { type: "action"; action: { index: number; tool: string; input: Record<string, unknown>; result: unknown; error?: string; timestamp: string; hash: string } }
  | { type: "plan"; plan: { summary: string; estimated_cost_per_hour: number; containers: unknown[]; has_smart_contracts: boolean; status: string } }
  | { type: "done"; message: string }
  | { type: "error"; message: string };

function getOrCreateTeam(): Promise<string> {
  const stored = localStorage.getItem("zkloud_team_id");
  if (stored) return Promise.resolve(stored);

  const name = "team-" + Math.random().toString(36).slice(2, 9);
  return fetch(`${API}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, public_key: "" }),
  })
    .then((r) => r.json())
    .then((t) => {
      localStorage.setItem("zkloud_team_id", t.id);
      localStorage.setItem("zkloud_team_name", t.name);
      return t.id as string;
    });
}

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

export default function DeployPage() {
  const [prompt, setPrompt] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<EventItem & { type: "plan" } | null>(null);
  const [doneMsg, setDoneMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll stream
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [events]);

  function pushEvent(e: EventItem) {
    setEvents((prev) => [...prev, e]);
  }

  async function handleDeploy() {
    if (!prompt.trim() && !repoUrl.trim()) return;
    setPhase("running");
    setEvents([]);
    setPlan(null);
    setDoneMsg("");
    setErrMsg("");

    let teamId: string;
    try {
      teamId = await getOrCreateTeam();
    } catch {
      setPhase("error");
      setErrMsg("Failed to register team. Is the backend running?");
      return;
    }

    let sess: { id: string };
    try {
      const res = await fetch(`${API}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, prompt: prompt || undefined, repo_url: repoUrl || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      sess = await res.json();
    } catch (e) {
      setPhase("error");
      setErrMsg(String(e));
      return;
    }

    setSessionId(sess.id);

    const wsBase = API.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/sessions/${sess.id}/stream`);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const evt: EventItem = JSON.parse(msg.data);
      if (evt.type === "plan") setPlan(evt as EventItem & { type: "plan" });
      if (evt.type === "done") { setDoneMsg(evt.message); setPhase("done"); }
      if (evt.type === "error") { setErrMsg(evt.message); setPhase("error"); }
      pushEvent(evt);
    };

    ws.onerror = () => {
      setPhase("error");
      setErrMsg("WebSocket connection failed.");
    };
  }

  const canDeploy = (prompt.trim() || repoUrl.trim()) && phase !== "running";

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0e0e0e", color: "#d1d5db", fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: "#6b7280" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Dashboard
          </Link>
          <span style={{ color: "#374151" }}>/</span>
          <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>New Deployment</span>
        </div>
        {sessionId && (
          <Link
            href={`/sessions/${sessionId}`}
            className="text-xs px-3 py-1 rounded-full transition-opacity hover:opacity-80"
            style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151" }}
          >
            Session: {sessionId.slice(0, 20)}…
          </Link>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero text */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#f3f4f6", letterSpacing: "-0.02em" }}>
            Deploy with AI
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Describe your stack in plain English or paste a GitHub URL. The agent provisions everything in seconds with a cryptographic audit trail.
          </p>
        </div>

        {/* Input area */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "#151515", border: "1px solid #1f2937" }}>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b7280" }}>
            What do you want to deploy?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Deploy a React frontend with a Node.js API and Postgres database"
            rows={4}
            disabled={phase === "running"}
            className="w-full bg-transparent resize-none text-sm outline-none placeholder:opacity-30 disabled:opacity-40"
            style={{ color: "#f3f4f6", fontFamily: "var(--font-inter), sans-serif" }}
          />
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #1f2937" }}>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6b7280" }}>
              GitHub URL <span style={{ color: "#374151" }}>(optional)</span>
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              disabled={phase === "running"}
              className="w-full bg-transparent text-sm outline-none placeholder:opacity-30 disabled:opacity-40"
              style={{ color: "#f3f4f6", fontFamily: "var(--font-space-mono), monospace" }}
            />
          </div>
        </div>

        <button
          onClick={handleDeploy}
          disabled={!canDeploy}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: phase === "running" ? "#1f2937" : "linear-gradient(135deg, #5c6e8c, #3b82f6)",
            color: "#fff",
            border: "none",
          }}
        >
          {phase === "running" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Agent working…
            </span>
          ) : "Deploy →"}
        </button>

        {/* Event stream */}
        {events.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
                Agent Activity
              </h2>
              {sessionId && (
                <Link href={`/sessions/${sessionId}`} className="text-xs hover:underline" style={{ color: "#5c6e8c" }}>
                  View full audit log →
                </Link>
              )}
            </div>
            <div
              ref={streamRef}
              className="rounded-2xl overflow-y-auto p-4 space-y-2"
              style={{ background: "#0a0a0a", border: "1px solid #1f2937", maxHeight: "420px" }}
            >
              {events.map((evt, i) => (
                <EventRow key={i} evt={evt} />
              ))}
            </div>
          </div>
        )}

        {/* Plan card */}
        {plan && (
          <div className="mt-6 rounded-2xl p-5" style={{ background: "#151515", border: "1px solid #374151" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📋</span>
              <h3 className="font-bold text-sm" style={{ color: "#f3f4f6" }}>Deployment Plan</h3>
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#1f2937", color: "#fbbf24" }}
              >
                Pending
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>{plan.plan.summary}</p>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Est. Cost</div>
                <div className="font-bold" style={{ color: "#34d399" }}>${plan.plan.estimated_cost_per_hour.toFixed(3)}/hr</div>
              </div>
              {plan.plan.containers && Array.isArray(plan.plan.containers) && (
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Containers</div>
                  <div className="font-bold" style={{ color: "#f3f4f6" }}>{plan.plan.containers.length}</div>
                </div>
              )}
              {plan.plan.has_smart_contracts && (
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>On-Chain</div>
                  <div className="font-bold" style={{ color: "#a78bfa" }}>Smart Contracts</div>
                </div>
              )}
            </div>
            <p className="text-xs mt-4" style={{ color: "#4b5563" }}>
              The agent is proceeding with provisioning. You can track progress in the activity log above.
            </p>
          </div>
        )}

        {/* Done card */}
        {phase === "done" && (
          <div className="mt-6 rounded-2xl p-5" style={{ background: "#0d1f17", border: "1px solid #166534" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
              <h3 className="font-bold text-sm" style={{ color: "#4ade80" }}>Deployment Complete</h3>
            </div>
            <p className="text-sm" style={{ color: "#86efac" }}>{doneMsg}</p>
            {sessionId && (
              <Link
                href={`/sessions/${sessionId}`}
                className="inline-block mt-4 text-xs px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#166534", color: "#4ade80" }}
              >
                View Audit Log & Attestation →
              </Link>
            )}
          </div>
        )}

        {/* Error card */}
        {phase === "error" && (
          <div className="mt-6 rounded-2xl p-4" style={{ background: "#1a0a0a", border: "1px solid #7f1d1d" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
              <h3 className="font-bold text-sm" style={{ color: "#f87171" }}>Deployment Failed</h3>
            </div>
            <p className="text-xs" style={{ color: "#fca5a5", fontFamily: "var(--font-space-mono), monospace" }}>{errMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ evt }: { evt: EventItem }) {
  if (evt.type === "message") {
    return (
      <div className="flex gap-3 items-start">
        <span className="text-xs mt-0.5" style={{ color: "#6b7280" }}>●</span>
        <p className="text-sm" style={{ color: "#9ca3af" }}>{evt.message}</p>
      </div>
    );
  }

  if (evt.type === "action") {
    const { tool, input, result, error, hash } = evt.action;
    const icon = toolIcons[tool] ?? "⚙️";
    const hasError = !!error;
    return (
      <div
        className="rounded-xl p-3"
        style={{
          background: hasError ? "#1a0a0a" : "#111827",
          border: `1px solid ${hasError ? "#7f1d1d" : "#1f2937"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: hasError ? "#f87171" : "#e5e7eb", fontFamily: "var(--font-space-mono), monospace" }}>
            {tool}
          </span>
          {hasError ? (
            <span className="ml-auto text-xs" style={{ color: "#ef4444" }}>failed</span>
          ) : (
            <span className="ml-auto text-xs" style={{ color: "#22c55e" }}>✓</span>
          )}
        </div>
        <div className="text-xs" style={{ color: "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
          {JSON.stringify(input, null, 0).slice(0, 120)}{JSON.stringify(input).length > 120 ? "…" : ""}
        </div>
        {(result || error) && (
          <div className="mt-1 text-xs" style={{ color: hasError ? "#fca5a5" : "#6b7280", fontFamily: "var(--font-space-mono), monospace" }}>
            {error ?? JSON.stringify(result, null, 0).slice(0, 100)}
          </div>
        )}
        <div className="mt-2 text-xs truncate" style={{ color: "#374151", fontFamily: "var(--font-space-mono), monospace" }}>
          {hash}
        </div>
      </div>
    );
  }

  if (evt.type === "done") {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
        <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>{evt.message}</span>
      </div>
    );
  }

  if (evt.type === "error") {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
        <span className="text-xs" style={{ color: "#f87171" }}>{evt.message}</span>
      </div>
    );
  }

  return null;
}
