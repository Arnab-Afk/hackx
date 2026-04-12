"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

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

export default function PlanReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Session not found");
        return r.json();
      })
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load session"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await apiFetch(`/sessions/${sessionId}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/sessions/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirming(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await apiFetch(`/sessions/${sessionId}`, { method: "DELETE" });
    } finally {
      router.push("/");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#6b7280" }}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading plan…
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111", color: "#f87171" }}>
        <div className="text-center">
          <p className="font-bold mb-2">Could not load plan</p>
          <p className="text-sm opacity-60 mb-4">{error}</p>
          <Link href="/" className="text-sm underline" style={{ color: "#e2f0d9" }}>← Dashboard</Link>
        </div>
      </div>
    );
  }

  const plan = session?.plan;

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
          <span className="text-sm" style={{ color: "#6b7280" }}>Plan Review</span>
        </div>
        <span
          className="text-xs px-3 py-1 rounded-sm"
          style={{ background: "#181818", color: "#f59e0b", border: "1px solid #1f2937" }}
        >
          Awaiting Confirmation
        </span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f3f4f6", letterSpacing: "-0.02em" }}>
            Review Deployment Plan
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            The agent has analyzed your request. Review the plan below, then confirm to begin provisioning.
          </p>
        </div>

        {/* Prompt */}
        <div className="rounded-sm p-4 mb-5" style={{ background: "#181818", border: "1px solid #1f2937" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#4b5563" }}>Your Request</div>
          <p className="text-sm" style={{ color: "#9ca3af" }}>{session?.prompt ?? "—"}</p>
        </div>

        {plan ? (
          <>
            {/* Summary */}
            <div className="rounded-sm p-5 mb-5" style={{ background: "#181818", border: "1px solid #374151" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📋</span>
                <h2 className="text-base font-bold" style={{ color: "#f3f4f6" }}>Deployment Plan</h2>
                {plan.has_smart_contracts && (
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-sm"
                    style={{ background: "#1e1b4b", color: "#a78bfa", border: "1px solid #312e81" }}
                  >
                    ⛓ On-Chain
                  </span>
                )}
              </div>
              <p className="text-sm mb-5" style={{ color: "#9ca3af", lineHeight: 1.7 }}>{plan.summary}</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-sm p-4" style={{ background: "#111111", border: "1px solid #1f2937" }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Estimated Cost</div>
                  <div className="text-2xl font-bold" style={{ color: "#f3f4f6", fontFamily: "var(--font-space-mono), monospace" }}>
                    ${plan.estimated_cost_per_hour.toFixed(3)}
                    <span className="text-sm font-normal ml-1" style={{ color: "#6b7280" }}>/hr</span>
                  </div>
                </div>
                <div className="rounded-sm p-4" style={{ background: "#111111", border: "1px solid #1f2937" }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Containers</div>
                  <div className="text-2xl font-bold" style={{ color: "#f3f4f6", fontFamily: "var(--font-space-mono), monospace" }}>
                    {plan.containers?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Container list */}
            {plan.containers && plan.containers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#4b5563" }}>
                  Containers to Provision
                </h3>
                <div className="space-y-2">
                  {plan.containers.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-sm px-4 py-3 flex items-center gap-4"
                      style={{ background: "#181818", border: "1px solid #1f2937" }}
                    >
                      <span className="text-base">📦</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>{c.name}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: "#6b7280" }}>{c.image}</div>
                      </div>
                      <div className="text-right text-xs" style={{ color: "#4b5563" }}>
                        {c.ram_mb && <div>{(c.ram_mb / 1024).toFixed(0)} GB RAM</div>}
                        {c.cpu_cores && <div>{c.cpu_cores} vCPU</div>}
                        {c.ports && c.ports.length > 0 && (
                          <div className="font-mono">{c.ports.join(", ")}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* On-chain attestation notice */}
            <div
              className="rounded-sm p-4 mb-8 flex items-start gap-3"
              style={{ background: "#0d0f1a", border: "1px solid #1e2a4a" }}
            >
              <span className="text-base mt-0.5">🔏</span>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "#818cf8" }}>Every action will be attested on-chain</div>
                <div className="text-xs" style={{ color: "#4b5563", lineHeight: 1.6 }}>
                  All agent tool calls will be hashed, Merkle-committed, and submitted to{" "}
                  <span style={{ color: "#6b7280" }}>Ethereum Attestation Service on Base Sepolia</span>{" "}
                  — creating a tamper-proof audit trail you can verify at any time.
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-sm p-4 mb-4" style={{ background: "#1a0a0a", border: "1px solid #7f1d1d" }}>
                <p className="text-xs" style={{ color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirming || rejecting}
                className="flex-1 py-3 rounded-sm font-semibold text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#e2f0d9", color: "#111111", border: "none" }}
              >
                {confirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Confirming…
                  </span>
                ) : "✓ Confirm & Deploy"}
              </button>
              <button
                onClick={handleReject}
                disabled={confirming || rejecting}
                className="px-6 py-3 rounded-sm font-semibold text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#181818", color: "#6b7280", border: "1px solid #1f2937" }}
              >
                {rejecting ? "Cancelling…" : "✕ Reject"}
              </button>
            </div>
          </>
        ) : (
          /* No plan yet — show loading or fallback */
          <div className="rounded-sm p-10 text-center" style={{ background: "#181818", border: "1px solid #1f2937" }}>
            {session?.state === "running" ? (
              <div>
                <div className="flex justify-center mb-3">
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="4" />
                    <path className="opacity-75" fill="#6b7280" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "#6b7280" }}>Agent is analyzing your request…</p>
                <Link href={`/sessions/${sessionId}`} className="inline-block mt-4 text-xs underline" style={{ color: "#e2f0d9" }}>
                  Watch live →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm mb-4" style={{ color: "#4b5563" }}>No plan available for this session.</p>
                <Link href={`/sessions/${sessionId}`} className="text-xs underline" style={{ color: "#e2f0d9" }}>
                  View session log →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
