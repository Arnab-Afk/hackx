"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type Session = {
  id: string;
  prompt: string;
  state: "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
};

const stateColor: Record<string, string> = {
  running: "#eab308",
  completed: "#22c55e",
  failed: "#ef4444",
};

const stateLabel: Record<string, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SessionsPage() {
  const { teamId } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    apiFetch(`/teams/${teamId}/sessions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#111111",
        fontFamily: 'Inter, var(--font-inter), "Inter Fallback", sans-serif',
        color: "#E5E7EB",
      }}
    >
      <Sidebar mode="user" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "32px" }}>
          {/* Header */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: "#F9FAFB", lineHeight: 1.2 }}>Sessions</p>
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                AI-agent deployment sessions for your team
              </p>
            </div>
            <Link
              href="/deploy"
              style={{
                display: "flex",
                alignItems: "center",
                height: 40,
                padding: "0 16px",
                borderRadius: 8,
                background: "#e2f0d9",
                color: "#111111",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              + New Deployment
            </Link>
          </header>

          {/* Stats row */}
          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {[
                { label: "Total Sessions", value: sessions.length },
                {
                  label: "Running",
                  value: sessions.filter((s) => s.state === "running").length,
                  accent: true,
                },
                {
                  label: "Success Rate",
                  value:
                    sessions.length > 0
                      ? `${Math.round((sessions.filter((s) => s.state === "completed").length / sessions.length) * 100)}%`
                      : "—",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    background: "#161618",
                    border: "1px solid #2C2C2E",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>{c.label}</p>
                  <p
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: c.accent ? "#eab308" : "#F9FAFB",
                    }}
                  >
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          {loading && (
            <div style={{ textAlign: "center", padding: 64, color: "#6B7280", fontSize: 14 }}>
              Loading sessions…
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#1a0a0a",
                border: "1px solid #7f1d1d",
                borderRadius: 12,
                padding: 24,
                color: "#fca5a5",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && !teamId && (
            <div style={{ textAlign: "center", padding: 64, color: "#6B7280", fontSize: 14 }}>
              Connect your wallet to view sessions.
            </div>
          )}

          {!loading && !error && teamId && sessions.length === 0 && (
            <div
              style={{
                background: "#161618",
                border: "1px solid #2C2C2E",
                borderRadius: 12,
                padding: 64,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>
                No sessions yet
              </p>
              <p style={{ fontSize: 13, color: "#4B5563", marginBottom: 24 }}>
                Deploy your first app to get started
              </p>
              <Link
                href="/deploy"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: "#e2f0d9",
                  color: "#111111",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Deploy Now →
              </Link>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div
              style={{
                background: "#161618",
                border: "1px solid #2C2C2E",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 120px 100px 56px",
                  padding: "10px 20px",
                  borderBottom: "1px solid #2C2C2E",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4B5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <span>Prompt</span>
                <span>Status</span>
                <span>Created</span>
                <span>Duration</span>
                <span></span>
              </div>

              {/* Rows */}
              {sessions.map((s) => {
                const color = stateColor[s.state] ?? "#6B7280";
                const durationMs =
                  new Date(s.updated_at).getTime() - new Date(s.created_at).getTime();
                const durationStr =
                  durationMs < 1000
                    ? `${durationMs}ms`
                    : durationMs < 60000
                    ? `${(durationMs / 1000).toFixed(1)}s`
                    : `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

                return (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 120px 100px 56px",
                      padding: "14px 20px",
                      borderBottom: "1px solid #1c1c1e",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {/* Prompt */}
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#F3F4F6",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginBottom: 2,
                        }}
                      >
                        {s.prompt || "(no prompt)"}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "#4B5563",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.id}
                      </p>
                    </div>

                    {/* Status */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: color,
                          boxShadow: `0 0 6px ${color}`,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>
                        {stateLabel[s.state] ?? s.state}
                      </span>
                    </div>

                    {/* Created */}
                    <span style={{ fontSize: 12, color: "#6B7280" }}>{timeSince(s.created_at)}</span>

                    {/* Duration */}
                    <span style={{ fontSize: 12, color: "#6B7280" }}>
                      {s.state === "running" ? "—" : durationStr}
                    </span>

                    {/* View link */}
                    <Link
                      href={`/sessions/${s.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.05)",
                        color: "#9CA3AF",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        border: "1px solid #2C2C2E",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
