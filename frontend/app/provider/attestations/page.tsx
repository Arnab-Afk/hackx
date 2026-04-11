"use client";

import { Sidebar } from "@/components/Sidebar";

const ACCENT = "#7c45ff";

type ProviderAttestation = {
  uid: string;
  session: string;
  user: string;
  timestamp: string;
  txHash: string;
};

const MOCK_ATTESTATIONS: ProviderAttestation[] = [
  { uid: "0xa1b2c3d4e5f60001…", session: "sess-demo-001", user: "0x1a2b…3c4d", timestamp: "2024-01-14 11:04", txHash: "0xf1e2d3c4…" },
  { uid: "0xa1b2c3d4e5f60002…", session: "sess-demo-003", user: "0x9c0d…1e2f", timestamp: "2024-01-13 09:45", txHash: "0xa8b7c6d5…" },
  { uid: "0xa1b2c3d4e5f60003…", session: "sess-demo-005", user: "0x7a8b…9c0d", timestamp: "2024-01-12 18:22", txHash: "0xd4e5f6a7…" },
  { uid: "0xa1b2c3d4e5f60004…", session: "sess-demo-006", user: "0x2b3c…4d5e", timestamp: "2024-01-11 14:55", txHash: "0x12345678…" },
];

export default function ProviderAttestationsPage() {
  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Issued Attestations</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                On-chain proofs you issued as compute provider via EAS
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Attestations Issued", value: String(MOCK_ATTESTATIONS.length) },
              { label: "Unique Users Served",  value: String(new Set(MOCK_ATTESTATIONS.map((a) => a.user)).size) },
              { label: "Schema",               value: "EAS v1.3" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{c.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 1fr 120px 140px 1fr", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Attestation UID</span>
              <span>Session</span>
              <span>User</span>
              <span>Timestamp</span>
              <span>Explorer</span>
            </div>
            {MOCK_ATTESTATIONS.map((a, i) => (
              <div
                key={i}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                style={{ gridTemplateColumns: "1fr 1fr 120px 140px 1fr", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: ACCENT }}>{a.uid}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(a.uid)}
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: "#6B7280", background: "#2A2A2D" }}
                  >copy</button>
                </div>
                <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{a.session}</span>
                <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{a.user}</span>
                <span className="text-xs font-mono" style={{ color: "#6B7280" }}>{a.timestamp}</span>
                <a
                  href={`https://sepolia.basescan.org/tx/${a.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono hover:underline flex items-center gap-1"
                  style={{ color: ACCENT }}
                >
                  {a.txHash}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
