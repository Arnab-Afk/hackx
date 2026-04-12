"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#7c45ff";

type AttestationRow = {
  session_id: string;
  attestation_uid: string;
  tx_hash: string;
  merkle_root?: string;
  schema_uid?: string;
  eas_scan_url?: string;
  created_at?: string;
};

export default function AttestationsPage() {
  const { teamId } = useAuth();
  const [rows, setRows] = useState<AttestationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaUID, setSchemaUID] = useState("—");

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    apiFetch(`/teams/${teamId}/attestations`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AttestationRow[]) => {
        setRows(Array.isArray(data) ? data : []);
        if (data?.[0]?.schema_uid) setSchemaUID(data[0].schema_uid.slice(0, 10) + "…");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Attestations</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                On-chain attestations issued via EAS on Base Sepolia
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono"
              style={{ background: "rgba(124,69,255,0.1)", border: "1px solid rgba(124,69,255,0.25)", color: ACCENT }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              EAS · Base Sepolia
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Attestations", value: loading ? "…" : String(rows.length) },
              { label: "Unique Sessions", value: loading ? "…" : String(new Set(rows.map((r) => r.session_id)).size) },
              { label: "Schema UID", value: schemaUID },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 120px 120px 1fr", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Attestation UID</span>
              <span>Session</span>
              <span>Merkle Root</span>
              <span>Explorer</span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              </div>
            )}

            {!loading && rows.length === 0 && (
              <p className="px-5 py-10 text-sm text-center" style={{ color: "#4B5563" }}>
                No attestations yet. Complete an agent session to generate one.
              </p>
            )}

            {rows.map((row, i) => (
              <div
                key={i}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                style={{ gridTemplateColumns: "1fr 120px 120px 1fr", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: ACCENT }}>
                    {row.attestation_uid ? row.attestation_uid.slice(0, 20) + "…" : "pending…"}
                  </span>
                  {row.attestation_uid && (
                    <button
                      onClick={() => navigator.clipboard.writeText(row.attestation_uid)}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ color: "#6B7280", background: "#2A2A2D" }}
                    >
                      copy
                    </button>
                  )}
                </div>
                <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>
                  {row.session_id?.slice(0, 10)}…
                </span>
                <span className="text-xs font-mono truncate" style={{ color: "#4B5563" }}>
                  {row.merkle_root ? row.merkle_root.slice(0, 12) + "…" : "—"}
                </span>
                {row.eas_scan_url ? (
                  <a
                    href={row.eas_scan_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono hover:underline flex items-center gap-1"
                    style={{ color: ACCENT }}
                  >
                    EAS Scan
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                ) : (
                  <span className="text-xs font-mono" style={{ color: "#4B5563" }}>—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

