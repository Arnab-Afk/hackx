"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type Secret = {
  id: string;
  name: string;
  value: string;
  createdAt: string;
};

const MOCK_SECRETS: Secret[] = [
  { id: "s1", name: "DB_PASSWORD", value: "••••••••••••", createdAt: "2024-01-10" },
  { id: "s2", name: "API_KEY", value: "••••••••••••", createdAt: "2024-01-12" },
  { id: "s3", name: "PRIVATE_KEY", value: "••••••••••••", createdAt: "2024-01-14" },
];

const ACCENT = "#7c45ff";
const ACCENT_BG = "rgba(124,69,255,0.1)";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>(MOCK_SECRETS);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  function handleAdd() {
    if (!newName.trim() || !newValue.trim()) return;
    const s: Secret = {
      id: "s" + Date.now(),
      name: newName.trim().toUpperCase().replace(/\s+/g, "_"),
      value: newValue.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setSecrets((prev) => [s, ...prev]);
    setNewName("");
    setNewValue("");
    setAdding(false);
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(id: string) {
    setSecrets((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Secrets</p>
              <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>
                Encrypted key-value secrets injected into your containers
              </p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-lg h-10 px-4 text-sm font-black"
              style={{ background: ACCENT, color: "#fff" }}
            >
              + Add Secret
            </button>
          </header>

          {/* Add Secret Form */}
          {adding && (
            <div className="mb-6 rounded-xl p-5 flex flex-col gap-4" style={{ background: "#161618", border: `1px solid ${ACCENT}` }}>
              <p className="text-sm font-bold" style={{ color: ACCENT }}>New Secret</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Key name</label>
                  <input
                    type="text"
                    placeholder="DB_PASSWORD"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-sm px-3 py-2.5 rounded-lg outline-none font-mono"
                    style={{ background: "#0A0A0A", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Value</label>
                  <input
                    type="password"
                    placeholder="secret value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="text-sm px-3 py-2.5 rounded-lg outline-none font-mono"
                    style={{ background: "#0A0A0A", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: ACCENT, color: "#fff" }}
                >
                  Save Secret
                </button>
                <button
                  onClick={() => { setAdding(false); setNewName(""); setNewValue(""); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "#2A2A2D", color: "#9CA3AF" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Secrets Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 2fr 120px 80px", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Key</span>
              <span>Value</span>
              <span>Created</span>
              <span />
            </div>
            {secrets.length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: "#4B5563" }}>No secrets yet.</p>
            )}
            {secrets.map((s) => (
              <div
                key={s.id}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                style={{ gridTemplateColumns: "1fr 2fr 120px 80px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-sm font-mono font-bold" style={{ color: "#F3F4F6" }}>{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono" style={{ color: "#9CA3AF" }}>
                    {revealed.has(s.id) ? s.value : "••••••••••••••••"}
                  </span>
                  <button
                    onClick={() => toggleReveal(s.id)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: "#6B7280", background: "#2A2A2D" }}
                  >
                    {revealed.has(s.id) ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="text-xs font-mono" style={{ color: "#4B5563" }}>{s.createdAt}</span>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs px-2 py-1 rounded font-medium justify-self-end"
                  style={{ color: "#DC3545", background: "rgba(220,53,69,0.1)" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs" style={{ color: "#4B5563" }}>
            Secrets are LUKS2-encrypted at rest and injected as environment variables inside the secure enclave.
          </p>
        </div>
      </main>
    </div>
  );
}
