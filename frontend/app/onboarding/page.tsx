"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { API, authHeaders } from "@/lib/api";

export default function OnboardingPage() {
  const { isAuthenticated, isAuthenticating, address, teamId, teamName, setTeam } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect if already named
  useEffect(() => {
    if (!isAuthenticating && !isAuthenticated) {
      router.replace("/");
    }
    if (isAuthenticated && teamName && !teamName.startsWith("account-")) {
      router.replace("/");
    }
  }, [isAuthenticated, isAuthenticating, teamName, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    if (trimmed.length < 2) { setError("Name must be at least 2 characters."); return; }
    if (trimmed.length > 48) { setError("Name too long (max 48 chars)."); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to save.");
        return;
      }
      const account = await res.json();
      setTeam(account.id, account.name);
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#08080a", fontFamily: "Inter, sans-serif" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-6" style={{ color: "#3f3f50" }}>
            COMPUT3
          </p>
          <p className="text-2xl font-bold" style={{ color: "#f0f0f5" }}>Set up your account</p>
          <p className="text-sm mt-1.5" style={{ color: "#5a5a6e" }}>
            You&apos;re connected as {shortAddr}. Choose a display name.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-md p-5 flex flex-col gap-4" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3f3f50" }}>
              Display name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. My Workspace"
              maxLength={48}
              className="rounded-md px-3 py-2.5 text-sm outline-none transition-all"
              style={{
                background: "#060608",
                border: error ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
                color: "#f0f0f5",
              }}
              onFocus={(e) => { if (!error) e.target.style.borderColor = "rgba(124,69,255,0.5)"; }}
              onBlur={(e) => { if (!error) e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all"
            style={{
              background: saving || !name.trim() ? "rgba(124,69,255,0.3)" : "#7c45ff",
              color: saving || !name.trim() ? "rgba(255,255,255,0.4)" : "#fff",
              cursor: saving || !name.trim() ? "default" : "pointer",
            }}
          >
            {saving && (
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            )}
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>

        <button
          onClick={() => router.push("/")}
          className="text-xs text-center"
          style={{ color: "#3f3f50", background: "transparent", border: "none", cursor: "pointer" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
