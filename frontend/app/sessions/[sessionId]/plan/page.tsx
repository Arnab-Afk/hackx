"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { MOCK_SESSIONS, MOCK_PLAN } from "@/lib/mockData";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type PlanData = {
  summary: string;
  estimated_cost_per_hour: number;
  containers: Array<{
    name: string;
    image: string;
    ram_mb?: number;
    cpu_cores?: number;
    ports?: string[];
  }>;
  has_smart_contracts: boolean;
  status: string;
};

type SessionData = {
  id: string;
  team_id: string;
  prompt: string;
  state: "running" | "completed" | "failed" | "pending";
  plan?: PlanData;
  created_at: string;
};

export default function PlanReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setSession)
      .catch(() => {
        const mock =
          MOCK_SESSIONS.find((s) => s.id === sessionId) ?? {
            ...MOCK_SESSIONS[0],
            id: sessionId,
          };
        setSession({ ...mock, plan: MOCK_PLAN } as unknown as SessionData);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/sessions/${sessionId}`);
    } catch (e) {
      setError(String(e));
      setConfirming(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await fetch(`${API}/sessions/${sessionId}`, { method: "DELETE" });
    } finally {
      router.push("/");
    }
  }

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
          <span className="text-xs uppercase tracking-widest">Loading plan…</span>
        </div>
      </div>
    );
  }

  const plan = session?.plan;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#0e0e0e",
        color: "#d1d5db",
        fontFamily: "var(--font-inter), sans-serif",
      }}
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
          <span style={{ color: "#6b7280", fontSize: "13px" }}>Plan Review</span>
        </div>

        {/* awaiting badge */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-sm"
          style={{
            background: "#181818",
            border: "1px solid #1f2937",
            fontSize: "11px",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#f59e0b" }}
          />
          <span style={{ color: "#f59e0b" }}>Awaiting confirmation</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: "#4b5563" }}
          >
            Session · {sessionId.slice(0, 24)}…
          </p>
          <h1
            className="font-semibold mb-2"
            style={{ fontSize: "22px", color: "#f3f4f6", letterSpacing: "-0.02em" }}
          >
            Review Deployment Plan
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            The agent has analyzed your request and generated a plan. Confirm
            to begin provisioning, or reject to cancel.
          </p>
        </div>

        {/* Prompt card */}
        <div
          className="p-4 mb-4 rounded-sm"
          style={{ background: "#181818", border: "1px solid #1f2937" }}
        >
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: "#4b5563" }}
          >
            Your request
          </p>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            {session?.prompt ?? "—"}
          </p>
        </div>

        {plan ? (
          <>
            {/* Plan summary */}
            <div
              className="p-5 mb-4 rounded-sm"
              style={{ background: "#181818", border: "1px solid #1f2937" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "#4b5563" }}
                >
                  Deployment plan
                </p>
                {plan.has_smart_contracts && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-sm"
                    style={{
                      background: "#1f2937",
                      color: "#5c6e8c",
                      fontSize: "10px",
                      letterSpacing: "0.06em",
                    }}
                  >
                    ON-CHAIN
                  </span>
                )}
              </div>

              <p
                className="text-sm mb-5"
                style={{ color: "#9ca3af", lineHeight: 1.7 }}
              >
                {plan.summary}
              </p>

              {/* Stats row */}
              <div
                className="grid grid-cols-2 gap-3 pt-4"
                style={{ borderTop: "1px solid #1f2937" }}
              >
                <div className="p-4 rounded-sm" style={{ background: "#111111", border: "1px solid #1f2937" }}>
                  <p
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "#4b5563", fontSize: "10px" }}
                  >
                    Est. cost
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      style={{
                        fontSize: "28px",
                        fontWeight: 700,
                        color: "#f3f4f6",
                        fontFamily: "var(--font-space-mono), monospace",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      ${plan.estimated_cost_per_hour.toFixed(3)}
                    </span>
                    <span style={{ color: "#6b7280", fontSize: "12px" }}>/hr</span>
                  </div>
                </div>
                <div className="p-4 rounded-sm" style={{ background: "#111111", border: "1px solid #1f2937" }}>
                  <p
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "#4b5563", fontSize: "10px" }}
                  >
                    Containers
                  </p>
                  <span
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#f3f4f6",
                      fontFamily: "var(--font-space-mono), monospace",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {plan.containers?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Container table */}
            {plan.containers && plan.containers.length > 0 && (
              <div
                className="rounded-sm mb-5"
                style={{ background: "#181818", border: "1px solid #1f2937", overflow: "hidden" }}
              >
                {/* table header */}
                <div
                  className="grid px-4 py-2"
                  style={{
                    gridTemplateColumns: "1fr 1fr 80px 80px 120px",
                    borderBottom: "1px solid #1f2937",
                    fontSize: "10px",
                    color: "#4b5563",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Name</span>
                  <span>Image</span>
                  <span>RAM</span>
                  <span>CPU</span>
                  <span>Ports</span>
                </div>
                {plan.containers.map((c, i) => (
                  <div
                    key={i}
                    className="grid items-center px-4 py-3"
                    style={{
                      gridTemplateColumns: "1fr 1fr 80px 80px 120px",
                      borderBottom:
                        i < plan.containers.length - 1
                          ? "1px solid #161616"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "#5c6e8c" }}
                      />
                      <span
                        className="font-medium"
                        style={{ fontSize: "13px", color: "#f3f4f6" }}
                      >
                        {c.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        fontFamily: "var(--font-space-mono), monospace",
                      }}
                    >
                      {c.image}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#6b7280",
                        fontFamily: "var(--font-space-mono), monospace",
                      }}
                    >
                      {c.ram_mb ? `${c.ram_mb}MB` : "—"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#6b7280",
                        fontFamily: "var(--font-space-mono), monospace",
                      }}
                    >
                      {c.cpu_cores ?? "—"}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {(c.ports ?? []).length > 0
                        ? c.ports!.map((p) => (
                            <span
                              key={p}
                              className="text-xs px-1.5 py-0.5 rounded-sm"
                              style={{
                                background: "#1f2937",
                                color: "#9ca3af",
                                fontFamily: "var(--font-space-mono), monospace",
                                fontSize: "10px",
                              }}
                            >
                              {p}
                            </span>
                          ))
                        : <span style={{ fontSize: "11px", color: "#374151" }}>internal</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-sm p-3 mb-4 flex items-center gap-2"
                style={{ background: "#181818", border: "1px solid #1f2937" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "#ef4444" }}
                />
                <p className="text-xs" style={{ color: "#6b7280" }}>
                  {error}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirming || rejecting}
                className="flex-1 py-3 rounded-sm font-semibold text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#5c6e8c", color: "#fff", border: "none" }}
              >
                {confirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
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
                    Confirming…
                  </span>
                ) : (
                  "Confirm & Deploy →"
                )}
              </button>
              <button
                onClick={handleReject}
                disabled={confirming || rejecting}
                className="px-6 py-3 rounded-sm font-semibold text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "#181818",
                  color: "#6b7280",
                  border: "1px solid #1f2937",
                }}
              >
                {rejecting ? "Cancelling…" : "Reject"}
              </button>
            </div>
          </>
        ) : (
          /* No plan yet */
          <div
            className="rounded-sm p-10 text-center"
            style={{ background: "#181818", border: "1px solid #1f2937" }}
          >
            {session?.state === "running" ? (
              <div>
                <div className="flex justify-center mb-3">
                  <svg
                    className="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#4b5563"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="#4b5563"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "#6b7280" }}>
                  Agent is analyzing your request…
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm mb-4" style={{ color: "#4b5563" }}>
                  No plan found for this session.
                </p>
                <Link
                  href="/"
                  className="text-xs underline"
                  style={{ color: "#5c6e8c" }}
                >
                  ← Back to dashboard
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
