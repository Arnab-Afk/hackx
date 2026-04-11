"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { WalletButton } from "@/components/WalletButton";
import { useAccount } from "wagmi";

const ACCENT = "#7c45ff";

type HardwareForm = {
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  pricePerHour: string;
  region: string;
};

const RAM_OPTIONS = ["4GB", "8GB", "16GB", "32GB", "64GB"];
const CPU_OPTIONS = ["2", "4", "8", "16", "32"];
const REGION_OPTIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1", "ap-northeast-1"];

export default function ProviderRegisterPage() {
  const { isConnected } = useAccount();
  const [form, setForm] = useState<HardwareForm>({
    name: "",
    cpu: "4",
    ram: "8GB",
    storage: "100",
    pricePerHour: "0.08",
    region: "us-east-1",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(key: keyof HardwareForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!isConnected) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="provider" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8 max-w-2xl">
          <header className="mb-6">
            <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>Register Hardware</p>
            <p className="text-sm font-mono mt-1" style={{ color: "#6B7280" }}>List your machine on the COMPUT3 marketplace</p>
          </header>

          {!isConnected ? (
            <div className="rounded-xl p-6 flex flex-col items-center gap-4" style={{ background: "#161618", border: `1px solid ${ACCENT}` }}>
              <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>Connect your wallet to register hardware</p>
              <WalletButton />
            </div>
          ) : submitted ? (
            <div className="rounded-xl p-6 flex flex-col gap-3" style={{ background: "rgba(40,167,69,0.06)", border: "1px solid rgba(40,167,69,0.25)" }}>
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <p className="text-sm font-bold" style={{ color: "#28A745" }}>Hardware registered successfully!</p>
              </div>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                Your machine <strong style={{ color: "#F3F4F6" }}>{form.name}</strong> is now listed in the marketplace.
                Sessions will be routed to your node automatically.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Hardware Name */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>Hardware Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Gaming PC, Home Server"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={{ background: "#161618", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                />
              </div>

              {/* CPU */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>CPU Cores</label>
                <div className="flex gap-2 flex-wrap">
                  {CPU_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleChange("cpu", opt)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        border: form.cpu === opt ? `1px solid ${ACCENT}` : "1px solid #2C2C2E",
                        background: form.cpu === opt ? "rgba(124,69,255,0.1)" : "transparent",
                        color: form.cpu === opt ? ACCENT : "#6B7280",
                      }}
                    >
                      {opt} cores
                    </button>
                  ))}
                </div>
              </div>

              {/* RAM */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>RAM</label>
                <div className="flex gap-2 flex-wrap">
                  {RAM_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleChange("ram", opt)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        border: form.ram === opt ? `1px solid ${ACCENT}` : "1px solid #2C2C2E",
                        background: form.ram === opt ? "rgba(124,69,255,0.1)" : "transparent",
                        color: form.ram === opt ? ACCENT : "#6B7280",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>Storage (GB)</label>
                <input
                  type="number"
                  min="20"
                  max="10000"
                  value={form.storage}
                  onChange={(e) => handleChange("storage", e.target.value)}
                  className="text-sm px-3 py-2.5 rounded-lg outline-none w-48"
                  style={{ background: "#161618", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                />
              </div>

              {/* Price per hour */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>Price / hour (USDC)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.pricePerHour}
                    onChange={(e) => handleChange("pricePerHour", e.target.value)}
                    className="text-sm px-3 py-2.5 rounded-lg outline-none w-48"
                    style={{ background: "#161618", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                  />
                  <span className="text-sm font-mono" style={{ color: "#6B7280" }}>USDC/hr</span>
                </div>
              </div>

              {/* Region */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: "#9CA3AF" }}>Region</label>
                <select
                  value={form.region}
                  onChange={(e) => handleChange("region", e.target.value)}
                  className="text-sm px-3 py-2.5 rounded-lg outline-none w-64"
                  style={{ background: "#161618", border: "1px solid #2C2C2E", color: "#E5E7EB" }}
                >
                  {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || submitting}
                className="flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-black disabled:opacity-30 mt-2"
                style={{ background: ACCENT, color: "#fff" }}
              >
                {submitting ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : null}
                {submitting ? "Registering…" : "Register Hardware"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
