"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";

const ACCENT = "#7c45ff";

const TOOL_COLORS: Record<string, { text: string; bg: string }> = {
  analyze_repo:             { text: "#7c45ff", bg: "rgba(124,69,255,0.1)" },
  generate_deployment_plan: { text: "#7c45ff", bg: "rgba(124,69,255,0.1)" },
  create_container:         { text: "#28A745", bg: "rgba(40,167,69,0.1)" },
  setup_database:           { text: "#FFC107", bg: "rgba(255,193,7,0.1)" },
  install_packages:         { text: "#9CA3AF", bg: "rgba(107,114,128,0.1)" },
  configure_network:        { text: "#17a2b8", bg: "rgba(23,162,184,0.1)" },
  setup_ide:                { text: "#9CA3AF", bg: "rgba(107,114,128,0.1)" },
  health_check:             { text: "#28A745", bg: "rgba(40,167,69,0.1)" },
};

function getTC(tool: string) {
  return TOOL_COLORS[tool] ?? { text: "#6B7280", bg: "rgba(107,114,128,0.1)" };
}

type SessionSummary = { id: string; prompt: string; state: string };
type Action = { tool: string; hash: string; input?: unknown; result?: unknown };
type ActionLog = { session_id: string; actions: Action[]; merkle_root?: string };

export default function AuditPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const teamId = localStorage.getItem("zkloud_team_id");
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/sessions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSessions(data);
          setSessionFilter(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionFilter || sessionFilter === "all") { setLog(null); return; }
    setLoadingLog(true);
    apiFetch(`/sessions/${sessionFilter}/log`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLog(data))
      .catch(() => setLog(null))
      .finally(() => setLoadingLog(false));
  }, [sessionFilter]);

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const actions: Action[] = log?.actions ?? [];

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Audit Trail</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                Immutable action log — every agent action hashed and stored on-chain
              </p>
            </div>
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#161618", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
            >
              <option value="all">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.id.slice(0, 16)}…</option>
              ))}
            </select>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Actions", value: loadingLog ? "…" : String(actions.length) },
              { label: "Merkle Root", value: log?.merkle_root ? log.merkle_root.slice(0, 18) + "…" : "—" },
              { label: "Verified", value: actions.length > 0 ? "On-chain" : "—" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-sm font-bold font-mono truncate" style={{ color: c.label === "Verified" && c.value === "On-chain" ? "#28A745" : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {loadingLog && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            </div>
          )}

          {!loadingLog && actions.length === 0 && (
            <p className="text-sm py-8 text-center" style={{ color: "#4B5563" }}>
              {sessions.length === 0 ? "No sessions yet." : "No action log for this session."}
            </p>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-x-4">
            {actions.map((action, i) => {
              const tc = getTC(action.tool);
              const isExpanded = expanded.has(i);
              const isLast = i === actions.length - 1;
              return (
                <>
                  <div key={`dot-${i}`} className="flex flex-col items-center gap-0">
                    <div
                      className="flex items-center justify-center rounded-full w-7 h-7 shrink-0"
                      style={{ background: tc.bg, border: `1px solid ${tc.text}` }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    {!isLast && <div className="w-px flex-1 mt-1" style={{ background: "#2C2C2E", minHeight: "24px" }} />}
                  </div>

                  <div
                    key={`card-${i}`}
                    className="mb-3 rounded-xl overflow-hidden cursor-pointer"
                    style={{ border: "1px solid #2C2C2E", background: "#161618" }}
                    onClick={() => toggle(i)}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold shrink-0" style={{ color: tc.text, background: tc.bg }}>
                          {action.tool}
                        </span>
                        <span className="text-xs font-mono truncate" style={{ color: "#6B7280" }}>
                          {action.hash.slice(0, 32)}…
                        </span>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2"
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: "1px solid #2C2C2E" }}>
                        {!!action.input && (
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>INPUT</p>
                            <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: "#0A0A0A", color: "#9CA3AF" }}>
                              {JSON.stringify(action.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {!!action.result && (
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>RESULT</p>
                            <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: "#0A0A0A", color: "#9CA3AF" }}>
                              {JSON.stringify(action.result, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          <span className="text-xs font-mono break-all" style={{ color: "#4B5563" }}>SHA256: {action.hash}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
