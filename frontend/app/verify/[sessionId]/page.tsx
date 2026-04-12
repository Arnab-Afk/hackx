"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

const EAS_SCHEMA_UID = "0x001219cb6b1ad28ce53a643f532872015acab85429133286b9e2c96e910945f0";
const EAS_SCAN_BASE = "https://base-sepolia.easscan.org";

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

type SessionData = {
  id: string;
  team_id: string;
  prompt: string;
  state: string;
  created_at: string;
  updated_at: string;
};

function computeMerkleRoot(actions: ActionItem[]): string {
  if (actions.length === 0) return "—";
  return "0x" + actions.map((a) => a.hash.replace(/^sha256:/, "")).join("").slice(0, 64);
}

export default function VerifyPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    Promise.all([
      apiFetch(`/sessions/${sessionId}`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`/sessions/${sessionId}/log`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sess, rawLog]) => {
        if (sess) {
          setSession(sess);
          if (rawLog) {
            setLog({
              ...rawLog,
              actions: typeof rawLog.actions === "string" ? JSON.parse(rawLog.actions) : rawLog.actions ?? [],
            });
          }
        } else {
          setError("Session not found");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load attestation"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#6b7280" }}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading attestation…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#f87171" }}>
        <div className="text-center">
          <p className="font-bold mb-2">Attestation not found</p>
          <p className="text-sm opacity-60 mb-4">{error}</p>
          <Link href="/" className="text-sm underline" style={{ color: "#e2f0d9" }}>← Dashboard</Link>
        </div>
      </div>
    );
  }

  const actions = log?.actions ?? [];
  const merkleRoot = computeMerkleRoot(actions);

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
          <span className="text-sm" style={{ color: "#6b7280" }}>Verify Attestation</span>
        </div>
        <Link
          href={`/sessions/${sessionId}`}
          className="text-xs px-3 py-1 rounded-sm transition-opacity hover:opacity-80"
          style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151" }}
        >
          View Session →
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f3f4f6", letterSpacing: "-0.02em" }}>
            On-Chain Attestation
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Every agent action is hashed and committed to Ethereum Attestation Service on Base Sepolia.
            Verify below that nothing external to the recorded tools was executed.
          </p>
        </div>

        {/* Session info */}
        <div className="rounded-sm p-4 mb-5" style={{ background: "#181818", border: "1px solid #1f2937" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Session</div>
              <div className="text-xs font-mono" style={{ color: "#6b7280" }}>{sessionId}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>State</div>
              <div
                className="text-xs font-semibold"
                style={{ color: session?.state === "completed" ? "#22c55e" : session?.state === "failed" ? "#ef4444" : "#f59e0b" }}
              >
                {session?.state?.toUpperCase()}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Prompt</div>
              <div className="text-xs" style={{ color: "#9ca3af" }}>{session?.prompt}</div>
            </div>
          </div>
        </div>

        {/* Merkle root banner */}
        <div
          className="rounded-sm p-5 mb-5"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#e2f0d9" }}>🔏 Action Merkle Root</h2>
          </div>
          <div
            className="p-3 rounded-sm font-mono text-xs break-all mb-3"
            style={{ background: "#111111", color: "#9ca3af", border: "1px solid #1f2937" }}
          >
            {merkleRoot}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                navigator.clipboard.writeText(merkleRoot);
                setCopiedRoot(true);
                setTimeout(() => setCopiedRoot(false), 1500);
              }}
              className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
              style={{ background: "#1f2937", color: "#e2f0d9" }}
            >
              {copiedRoot ? "Copied!" : "Copy Root"}
            </button>
            <a
              href={`${EAS_SCAN_BASE}/schema/view/${EAS_SCHEMA_UID}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
              style={{ background: "#1f2937", color: "#e2f0d9" }}
            >
              EAS Schema →
            </a>
            <a
              href={`${EAS_SCAN_BASE}/attestations?schemaId=${EAS_SCHEMA_UID}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
              style={{ background: "#1f2937", color: "#e2f0d9" }}
            >
              All Attestations →
            </a>
          </div>
        </div>

        {/* How to verify callout */}
        <div
          className="rounded-sm p-4 mb-6"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <div className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "#6b7280" }}>How to verify</div>
          <ol className="space-y-1" style={{ color: "#6b7280", fontSize: "12px", lineHeight: 1.7 }}>
            <li>1. Copy the Action Merkle Root above</li>
            <li>2. Open the EAS schema link and find the attestation for this session ID</li>
            <li>3. Confirm the <code className="text-xs px-1 rounded-sm" style={{ background: "#1f2937", color: "#9ca3af" }}>actionMerkleRoot</code> field matches</li>
            <li>4. Independently hash the action log below and compare — they must match</li>
          </ol>
        </div>

        {/* Action log */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#4b5563" }}>
            Action Log — {actions.length} tool calls
          </h2>

          {actions.length === 0 ? (
            <div className="rounded-sm p-8 text-center" style={{ background: "#181818", border: "1px solid #1f2937" }}>
              <p className="text-sm" style={{ color: "#4b5563" }}>
                {session?.state === "running"
                  ? "Session is still running — check back when it completes."
                  : "No action log recorded for this session."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((action, i) => {
                const isExpanded = expanded[i];
                const hasError = !!action.error;
                return (
                  <div
                    key={i}
                    className="rounded-sm overflow-hidden"
                    style={{ background: "#181818", border: `1px solid ${hasError ? "#7f1d1d" : "#1f2937"}` }}
                  >
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "#1f2937", color: "#6b7280" }}
                      >
                        {action.index}
                      </span>
                      <span
                        className="text-xs font-semibold font-mono flex-1"
                        style={{ color: hasError ? "#f87171" : "#e5e7eb", fontFamily: "var(--font-space-mono), monospace" }}
                      >
                        {action.tool}
                      </span>
                      <span className="text-xs shrink-0" style={{ color: "#374151", fontFamily: "var(--font-space-mono), monospace" }}>
                        {action.hash.slice(0, 16)}…
                      </span>
                      {hasError ? (
                        <span className="text-xs font-semibold shrink-0" style={{ color: "#ef4444" }}>✗</span>
                      ) : (
                        <span className="text-xs font-semibold shrink-0" style={{ color: "#22c55e" }}>✓</span>
                      )}
                      <svg
                        xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #1f2937" }}>
                        <div className="pt-3">
                          <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "#4b5563" }}>Input</div>
                          <pre
                            className="text-xs p-3 rounded-lg overflow-x-auto"
                            style={{ background: "#0a0a0a", color: "#9ca3af", fontFamily: "var(--font-space-mono), monospace", lineHeight: 1.6 }}
                          >
                            {JSON.stringify(action.input, null, 2)}
                          </pre>
                        </div>
                        {(action.result !== undefined || action.error) && (
                          <div>
                            <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: hasError ? "#7f1d1d" : "#4b5563" }}>
                              {hasError ? "Error" : "Result"}
                            </div>
                            <pre
                              className="text-xs p-3 rounded-lg overflow-x-auto"
                              style={{ background: hasError ? "#1a0a0a" : "#0a0a0a", color: hasError ? "#fca5a5" : "#6b7280", fontFamily: "var(--font-space-mono), monospace", lineHeight: 1.6 }}
                            >
                              {action.error ?? JSON.stringify(action.result, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="pt-1">
                          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#374151" }}>SHA-256 Hash</div>
                          <code className="text-xs break-all" style={{ color: "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
                            {action.hash}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-10 pt-6 flex items-center justify-between" style={{ borderTop: "1px solid #1f2937" }}>
          <Link href="/" className="text-xs hover:underline" style={{ color: "#4b5563" }}>← Dashboard</Link>
          <Link href={`/sessions/${sessionId}`} className="text-xs hover:underline" style={{ color: "#e2f0d9" }}>Full Action Log →</Link>
        </div>
      </div>
      </div>
    </div>
  );
}
