"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/api";

type Secret = {
  id: number;
  name: string;
  created_at: string;
};

const ACCENT = "#7c45ff";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadSecrets() {
    apiFetch("/secrets")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSecrets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSecrets(); }, []);

  async function handleAdd() {
    if (!newName.trim() || !newValue.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/secrets", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim().toUpperCase().replace(/\s+/g, "_"), value: newValue.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setNewValue("");
        setAdding(false);
        loadSecrets();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await apiFetch(`/secrets/${id}`, { method: "DELETE" });
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
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: ACCENT, color: "#fff" }}
                >
                  {saving ? "Saving…" : "Save Secret"}
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

          <div className="rounded-xl overflow-hidden" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 120px 80px", color: "#4B5563", borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}
            >
              <span>Key</span>
              <span>Created</span>
              <span />
            </div>
            {loading && (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              </div>
            )}
            {!loading && secrets.length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: "#4B5563" }}>No secrets yet.</p>
            )}
            {secrets.map((s) => (
              <div
                key={s.id}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors"
                style={{ gridTemplateColumns: "1fr 120px 80px", borderBottom: "1px solid rgba(44,44,46,0.6)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-sm font-mono font-bold" style={{ color: "#F3F4F6" }}>{s.name}</span>
                <span className="text-xs font-mono" style={{ color: "#4B5563" }}>
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                </span>
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
