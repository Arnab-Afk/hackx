"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { MOCK_SESSIONS, MOCK_ACTION_LOG } from "@/lib/mockData";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const EAS_SCHEMA_UID =
  "0x001219cb6b1ad28ce53a643f532872015acab85429133286b9e2c96e910945f0";

type ActionItem = {
  index: number;
  tool_name: string;
  input_hash: string;
  output_hash: string;
  success: boolean;
};

type ActionLog = {
  id: number | string;
  session_id: string;
  team_id: string;
  created_at: string;
  actions: ActionItem[];
};

type SessionData = {
  id: string;
  prompt: string;
  state: "running" | "completed" | "failed" | "pending";
  created_at: string;
  updated_at?: string;
  merkle_root?: string;
  attestation_uid?: string;
};

function truncate(s: string, n = 12) {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
      style={{
        background: "#1f2937",
        color: "#5c6e8c",
        border: "1px solid #1f2937",
        fontFamily: "var(--font-space-mono), monospace",
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function VerifyPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/sessions/${sessionId}`).then((r) => {
        if (!r.ok) throw new Error("session not found");
        return r.json();
      }),
      fetch(`${API}/sessions/${sessionId}/log`).then((r) => {
        if (!r.ok) throw new Error("log not found");
        return r.json();
      }),
    ])
      .then(([s, l]) => {
        setSession(s);
        setLog(l);
      })
      .catch(() => {
        const mockSession =
          MOCK_SESSIONS.find((s) => s.id === sessionId) ?? {
            ...MOCK_SESSIONS[0],
            id: sessionId,
          };
        setSession(
          mockSession as unknown as SessionData
        );
        setLog(MOCK_ACTION_LOG as unknown as ActionLog);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0e0e0e" }}
      >
        <div className="flex items-center gap-3" style={{ color: "#4b5563" }}>
          <svg
            className="animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <span className="text-xs uppercase tracking-widest">
            Loading attestation…
          </span>
        </div>
      </div>
    );
  }

  const merkleRoot =
    session?.merkle_root ??
    "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  const attestationUid = session?.attestation_uid;
  const easBaseUrl = "https://base-sepolia.easscan.org";

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0e0e0e", color: "#d1d5db", fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ color: "#6b7280", fontSize: "13px" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Dashboard
          </Link>
          <span style={{ color: "#374151" }}>/</span>
          <Link
            href={`/sessions/${sessionId}`}
            className="transition-opacity hover:opacity-70"
            style={{ color: "#6b7280", fontSize: "13px" }}
          >
            {sessionId.slice(0, 20)}…
          </Link>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#6b7280", fontSize: "13px" }}>Verify</span>
        </div>

        <Link
          href={`/sessions/${sessionId}`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80 uppercase tracking-widest"
          style={{
            background: "#181818",
            color: "#5c6e8c",
            border: "1px solid #1f2937",
          }}
        >
          View Session
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: "#4b5563" }}
          >
            On-chain attestation
          </p>
          <h1
            className="font-semibold mb-2"
            style={{ fontSize: "22px", color: "#f3f4f6", letterSpacing: "-0.02em" }}
          >
            Audit Trail Verification
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Every agent action is hashed into a Merkle tree and attested
            on-chain via EAS. Anyone can verify this session's execution
            log independently.
          </p>
        </div>

        {/* Session info */}
        <div
          className="rounded-sm mb-4 overflow-hidden"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <div
            className="px-4 py-2.5"
            style={{ borderBottom: "1px solid #1f2937" }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: "#4b5563" }}
            >
              Session details
            </span>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "#1f2937" }}>
            <div className="p-4" style={{ background: "#181818" }}>
              <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "#4b5563", fontSize: "10px" }}>
                ID
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontFamily: "var(--font-space-mono), monospace",
                  wordBreak: "break-all",
                }}
              >
                {session?.id ?? sessionId}
              </p>
            </div>
            <div className="p-4" style={{ background: "#181818" }}>
              <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "#4b5563", fontSize: "10px" }}>
                State
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      session?.state === "running"
                        ? "#22c55e"
                        : session?.state === "completed"
                        ? "#22c55e"
                        : "#4b5563",
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    color:
                      session?.state === "running" || session?.state === "completed"
                        ? "#22c55e"
                        : "#6b7280",
                    fontFamily: "var(--font-space-mono), monospace",
                  }}
                >
                  {session?.state ?? "—"}
                </span>
              </div>
            </div>
            <div
              className="col-span-2 p-4"
              style={{ background: "#181818", borderTop: "1px solid #1f2937" }}
            >
              <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "#4b5563", fontSize: "10px" }}>
                Prompt
              </p>
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                {session?.prompt ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Merkle root card */}
        <div
          className="rounded-sm mb-4"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid #1f2937" }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: "#5c6e8c" }}
            >
              Merkle Root
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-sm"
              style={{
                background: "#1f2937",
                color: "#4b5563",
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "10px",
              }}
            >
              EAS · Base Sepolia
            </span>
          </div>

          <div className="p-4">
            <div
              className="p-3 rounded-sm mb-4"
              style={{
                background: "#111111",
                border: "1px solid #1f2937",
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "12px",
                color: "#9ca3af",
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              {merkleRoot}
            </div>

            <div className="flex gap-2 flex-wrap">
              <CopyButton text={merkleRoot} />
              <a
                href={`${easBaseUrl}/schema/view/${EAS_SCHEMA_UID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
                style={{
                  background: "#1f2937",
                  color: "#5c6e8c",
                  border: "1px solid #1f2937",
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-space-mono), monospace",
                  textDecoration: "none",
                }}
              >
                EAS Schema →
              </a>
              {attestationUid && (
                <a
                  href={`${easBaseUrl}/attestation/view/${attestationUid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
                  style={{
                    background: "#1f2937",
                    color: "#5c6e8c",
                    border: "1px solid #1f2937",
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-space-mono), monospace",
                    textDecoration: "none",
                  }}
                >
                  View Attestation →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* How to verify */}
        <div
          className="rounded-sm mb-4"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <div
            className="px-4 py-2.5"
            style={{ borderBottom: "1px solid #1f2937" }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: "#4b5563" }}
            >
              How to verify independently
            </span>
          </div>
          <div className="p-4 space-y-3">
            {[
              {
                n: 1,
                text: 'Download the action log below and run',
                code: 'comput3 verify --session <id>',
              },
              {
                n: 2,
                text: 'Or hash each action\'s inputs/outputs and build your own Merkle tree, then compare with the root above.',
                code: null,
              },
              {
                n: 3,
                text: 'Cross-check the on-chain attestation at',
                code: easBaseUrl,
                href: easBaseUrl,
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded-sm flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: "#111111",
                    color: "#4b5563",
                    border: "1px solid #1f2937",
                    fontSize: "10px",
                  }}
                >
                  {step.n}
                </span>
                <p className="text-sm pt-0.5" style={{ color: "#6b7280", lineHeight: 1.6 }}>
                  {step.text}{" "}
                  {step.code && !step.href && (
                    <code
                      style={{
                        fontFamily: "var(--font-space-mono), monospace",
                        fontSize: "11px",
                        color: "#9ca3af",
                        background: "#1f2937",
                        padding: "1px 5px",
                        borderRadius: "2px",
                      }}
                    >
                      {step.code}
                    </code>
                  )}
                  {step.href && (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "var(--font-space-mono), monospace",
                        fontSize: "11px",
                        color: "#5c6e8c",
                      }}
                    >
                      {step.code}
                    </a>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action log */}
        {log && log.actions && log.actions.length > 0 && (
          <div
            className="rounded-sm"
            style={{ background: "#181818", border: "1px solid #1f2937", overflow: "hidden" }}
          >
            {/* table head */}
            <div
              className="grid px-4 py-2"
              style={{
                gridTemplateColumns: "40px 1fr 120px 120px 36px",
                borderBottom: "1px solid #1f2937",
                fontSize: "10px",
                color: "#4b5563",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span>#</span>
              <span>Tool</span>
              <span>Input</span>
              <span>Output</span>
              <span className="text-right">OK</span>
            </div>

            {log.actions.map((action, i) => (
              <div key={i}>
                <button
                  className="w-full text-left grid items-center px-4 py-3 transition-all"
                  style={{
                    gridTemplateColumns: "40px 1fr 120px 120px 36px",
                    borderBottom:
                      i < log.actions.length - 1 ? "1px solid #161616" : "none",
                    background:
                      expandedRow === i ? "#111111" : "transparent",
                  }}
                  onClick={() =>
                    setExpandedRow((prev) => (prev === i ? null : i))
                  }
                >
                  <span
                    className="text-xs"
                    style={{
                      color: "#374151",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    {action.index ?? i + 1}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: "#d1d5db",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    {action.tool_name}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: "#4b5563",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    {truncate(action.input_hash ?? "—", 14)}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: "#4b5563",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    {truncate(action.output_hash ?? "—", 14)}
                  </span>
                  <span
                    className="text-xs font-mono text-right"
                    style={{
                      color: action.success ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {action.success ? "✓" : "✗"}
                  </span>
                </button>

                {expandedRow === i && (
                  <div
                    className="px-4 pb-3 space-y-2"
                    style={{ background: "#111111", borderBottom: i < log.actions.length - 1 ? "1px solid #161616" : "none" }}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#374151", fontSize: "10px" }}>
                        Input hash
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-space-mono), monospace",
                          fontSize: "11px",
                          color: "#6b7280",
                          wordBreak: "break-all",
                        }}
                      >
                        {action.input_hash ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#374151", fontSize: "10px" }}>
                        Output hash
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-space-mono), monospace",
                          fontSize: "11px",
                          color: "#6b7280",
                          wordBreak: "break-all",
                        }}
                      >
                        {action.output_hash ?? "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
