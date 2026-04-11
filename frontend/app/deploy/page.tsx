"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAccount } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

// ── types ─────────────────────────────────────────────────────────────────────

type DeployOption = {
  type: "frontend" | "backend";
  framework: string;
  language: string;
  install_cmd: string;
  build_cmd: string;
  start_cmd: string;
  port: number;
};

type RepoScan = {
  repo_url: string;
  options: DeployOption[];
  env_vars: string[];
};

type Workspace = {
  container_id: string;
  ssh_port: number;
  app_port: number;
  username: string;
  password: string;
  storage_path: string;
  status: string;
};

type DeployResult = {
  container_id: string;
  framework: string;
  type: string;
  port: number;
  app_url: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

const RAM_MB: Record<string, number> = { "1 GB": 1024, "2 GB": 2048, "4 GB": 4096, "8 GB": 8192 };
const CPU_CORES: Record<string, number> = { "1 core": 1, "2 cores": 2, "4 cores": 4 };

const FRAMEWORK_ICONS: Record<string, string> = {
  nextjs: "▲", react: "⚛", vue: "🟩", sveltekit: "🔥", nuxt: "💚",
  express: "🟨", fastify: "⚡", nestjs: "🐱", fastapi: "🚀", flask: "🌶",
  django: "🎸", go: "🐹", static: "📄",
};

function FrameworkBadge({ opt }: { opt: DeployOption }) {
  const icon = FRAMEWORK_ICONS[opt.framework] ?? "📦";
  const color = opt.type === "frontend" ? "#7c45ff" : "#0ea5e9";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {opt.type}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", textTransform: "capitalize" }}>
            {opt.framework}
          </p>
          <p style={{ fontSize: 11, color: "#6B7280" }}>:{opt.port} · {opt.language}</p>
        </div>
        <span style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "2px 8px",
          borderRadius: 99, color, background: `${color}22`, border: `1px solid ${color}44`,
        }}>
          {opt.type}
        </span>
      </div>
      <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4B5563", marginTop: 2 }}>
        {opt.start_cmd}
      </p>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

type Phase = "repo" | "scanning" | "pick" | "vm" | "deploying" | "done" | "error";

export default function DeployPage() {
  const router = useRouter();
  const { address } = useAccount();

  const [phase, setPhase] = useState<Phase>("repo");
  const [errMsg, setErrMsg] = useState("");

  // Stage 1 — repo
  const [repoURL, setRepoURL] = useState("");
  const [githubConnected, setGithubConnected] = useState(false);

  // Stage 2 — scan
  const [scan, setScan] = useState<RepoScan | null>(null);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  // Stage 3 — VM
  const [ram, setRam] = useState("2 GB");
  const [cpu, setCpu] = useState("2 cores");
  const [sessionId, setSessionId] = useState("");

  // Stage 4 — result
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  useEffect(() => {
    // If user came back from GitHub OAuth, the token is stored server-side.
    // Just mark as connected.
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setGithubConnected(true);
      router.replace("/deploy");
    }
  }, [router]);

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!repoURL.trim()) return;
    setPhase("scanning");
    setErrMsg("");
    try {
      const res = await fetch(`${API}/repos/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoURL.trim(), wallet: address ?? "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: RepoScan = await res.json();
      if (!data.options?.length) throw new Error("No deployable components detected. Is this a supported project?");
      setScan(data);
      // pre-fill env var keys
      const defaults: Record<string, string> = {};
      (data.env_vars ?? []).forEach((k) => (defaults[k] = ""));
      setEnvVars(defaults);
      setPhase("pick");
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
    }
  }

  async function handleDeploy() {
    if (!scan) return;
    setPhase("deploying");
    setErrMsg("");

    // Get or create team
    let teamId = localStorage.getItem("zkloud_team_id");
    if (!teamId) {
      const name = "team-" + Math.random().toString(36).slice(2, 9);
      const res = await fetch(`${API}/teams`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, public_key: "" }),
      });
      if (!res.ok) { setPhase("error"); setErrMsg("Could not create team"); return; }
      const t = await res.json();
      localStorage.setItem("zkloud_team_id", t.id);
      localStorage.setItem("zkloud_team_name", t.name);
      teamId = t.id;
    }

    try {
      // 1. Allocate encrypted workspace
      const wsRes = await fetch(`${API}/workspaces`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          ram_mb: RAM_MB[ram] ?? 2048,
          cpu_cores: CPU_CORES[cpu] ?? 2,
          session_id: sessionId || undefined,
        }),
      });
      if (!wsRes.ok) throw new Error("Workspace allocation failed: " + await wsRes.text());
      const ws: Workspace = await wsRes.json();
      setWorkspace(ws);

      // 2. Wait for workspace to be ready (poll status)
      let ready = ws.status === "ready";
      for (let i = 0; i < 60 && !ready; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await fetch(`${API}/workspaces/${ws.container_id}/status`).then((r) => r.json());
        if (st.status === "ready") ready = true;
      }
      if (!ready) throw new Error("Workspace timed out waiting to be ready");

      // 3. Deploy the repo into the workspace
      const depRes = await fetch(`${API}/workspaces/${ws.container_id}/deploy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: scan.repo_url,
          option_index: selectedOption,
          env_vars: envVars,
          wallet: address ?? "",
        }),
      });
      if (!depRes.ok) throw new Error("Deploy failed: " + await depRes.text());
      const dep: DeployResult = await depRes.json();
      setDeployResult(dep);
      setPhase("done");

      // Save to local history
      const hist: string[] = JSON.parse(localStorage.getItem("zkloud_workspaces") ?? "[]");
      localStorage.setItem("zkloud_workspaces", JSON.stringify([ws.container_id, ...hist].slice(0, 20)));
    } catch (e) {
      setPhase("error");
      setErrMsg(String(e));
    }
  }

  function connectGitHub() {
    if (!address) { alert("Connect your wallet first"); return; }
    window.location.href = `${API}/auth/github?wallet=${address}`;
  }

  // ── stage labels ─────────────────────────────────────────────────────────────

  const stageStatus = (s: Phase[]) =>
    s.includes(phase) ? "active" : (
      phase === "done" || (s[0] === "repo" && ["scanning","pick","vm","deploying","done"].includes(phase)) ||
      (s[0] === "pick" && ["vm","deploying","done"].includes(phase)) ||
      (s[0] === "vm" && ["deploying","done"].includes(phase))
        ? "done" : "pending"
    );

  const stages = [
    { id: ["repo", "scanning"] as Phase[], label: "Connect Repository", sub: githubConnected ? "GitHub OAuth" : repoURL ? repoURL.split("/").slice(-1)[0] : "Link source code" },
    { id: ["pick"] as Phase[], label: "Detect Stack", sub: scan ? `${scan.options.length} option${scan.options.length !== 1 ? "s" : ""} found` : "Auto-detect framework" },
    { id: ["vm"] as Phase[], label: "Configure VM", sub: `${ram} · ${cpu}` },
    { id: ["deploying", "done"] as Phase[], label: "Deploy", sub: deployResult ? deployResult.framework : "Encrypted workspace" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0A0A0A", fontFamily: "Inter, sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "32px" }}>

          {/* Header */}
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: "#F9FAFB", lineHeight: 1.2 }}>New Deployment</p>
              <p style={{ fontSize: 13, fontFamily: "monospace", color: "#6B7280", marginTop: 4 }}>
                Encrypted workspace · blockchain-gated
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/" style={{ display: "flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 8, background: "#2A2A2D", color: "#E5E7EB", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                ← Dashboard
              </Link>
            </div>
          </header>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Status", value: phase === "deploying" ? "Deploying…" : phase === "done" ? "Live" : phase === "error" ? "Failed" : phase === "scanning" ? "Scanning…" : "Ready", accent: ["deploying","scanning"].includes(phase) },
              { label: "Repository", value: repoURL ? repoURL.split("/").slice(-1)[0] || repoURL : "—" },
              { label: "Framework", value: scan?.options[selectedOption]?.framework ?? "—" },
              { label: "VM", value: `${ram} / ${cpu}` },
            ].map((c) => (
              <div key={c.label} style={{ background: "#161618", border: "1px solid #2C2C2E", borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>{c.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: c.accent ? "#7c45ff" : "#F9FAFB" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32 }}>

            {/* Left: stages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Pipeline Stages</h2>
              {stages.map((s, i) => {
                const st = stageStatus(s.id);
                const dotColor = st === "done" ? "#28A745" : st === "active" ? "#7c45ff" : "#4B5563";
                const bgColor = st === "active" ? "rgba(124,69,255,0.08)" : "transparent";
                const border = st === "active" ? "1px solid #7c45ff33" : "1px solid transparent";
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: st === "active" ? "rgba(124,69,255,0.15)" : st === "done" ? "rgba(40,167,69,0.15)" : "#1C1C1E",
                      }}>
                        {st === "done"
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          : st === "active"
                          ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c45ff" }} />
                          : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4B5563" }} />
                        }
                      </div>
                      {i < stages.length - 1 && <div style={{ width: 1, flex: 1, background: "#2C2C2E", minHeight: 24 }} />}
                    </div>
                    <div style={{ paddingBottom: 20, paddingLeft: 4, background: bgColor, border, borderRadius: 8, padding: st === "active" ? "10px 12px" : "4px 0", marginBottom: st === "active" ? 4 : 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: st === "active" ? "#7c45ff" : st === "done" ? "#F3F4F6" : "#4B5563" }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: 11, color: st === "done" ? "#28A745" : "#6B7280", marginTop: 2 }}>{s.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: active panel */}
            <div style={{ background: "#161618", border: "1px solid #2C2C2E", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* ── Stage 1: Connect repo ── */}
              {(phase === "repo" || phase === "scanning") && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Connect Repository</p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>Paste a public GitHub URL or authorize for private repos</p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="https://github.com/owner/repo"
                      value={repoURL}
                      onChange={(e) => setRepoURL(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #2C2C2E", background: "#0A0A0A", color: "#E5E7EB", fontSize: 13, outline: "none" }}
                    />
                    <button
                      onClick={handleScan}
                      disabled={!repoURL.trim() || phase === "scanning"}
                      style={{ padding: "10px 20px", borderRadius: 8, background: "#7c45ff", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: !repoURL.trim() ? 0.4 : 1 }}
                    >
                      {phase === "scanning" ? "Scanning…" : "Scan →"}
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, height: 1, background: "#2C2C2E" }} />
                    <span style={{ fontSize: 11, color: "#4B5563" }}>or connect private repos</span>
                    <div style={{ flex: 1, height: 1, background: "#2C2C2E" }} />
                  </div>

                  <button
                    onClick={connectGitHub}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 8, background: githubConnected ? "rgba(40,167,69,0.1)" : "#21262D", border: `1px solid ${githubConnected ? "rgba(40,167,69,0.3)" : "#30363D"}`, color: githubConnected ? "#28A745" : "#E5E7EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                    {githubConnected ? "GitHub Connected ✓" : "Authorize with GitHub"}
                  </button>
                </div>
              )}

              {/* ── Stage 2: Pick option ── */}
              {phase === "pick" && scan && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Detected Stack</p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>Select what to deploy from <span style={{ fontFamily: "monospace" }}>{scan.repo_url.split("/").slice(-1)[0]}</span></p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {scan.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedOption(i)}
                        style={{
                          textAlign: "left", padding: 16, borderRadius: 10,
                          border: `1px solid ${selectedOption === i ? "#7c45ff" : "#2C2C2E"}`,
                          background: selectedOption === i ? "rgba(124,69,255,0.07)" : "#0A0A0A",
                          cursor: "pointer",
                        }}
                      >
                        <FrameworkBadge opt={opt} />
                      </button>
                    ))}
                  </div>

                  {/* Env vars */}
                  {Object.keys(envVars).length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>Environment Variables</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Object.keys(envVars).map((k) => (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280", minWidth: 140 }}>{k}</span>
                            <input
                              type="text"
                              placeholder="value"
                              value={envVars[k]}
                              onChange={(e) => setEnvVars((prev) => ({ ...prev, [k]: e.target.value }))}
                              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #2C2C2E", background: "#0A0A0A", color: "#E5E7EB", fontSize: 12, outline: "none", fontFamily: "monospace" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setPhase("vm")}
                    style={{ alignSelf: "flex-end", padding: "10px 24px", borderRadius: 8, background: "#7c45ff", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Configure VM →
                  </button>
                </div>
              )}

              {/* ── Stage 3: VM config ── */}
              {phase === "vm" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Configure Workspace</p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>LUKS-encrypted VM — your files are AES-256 at rest</p>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>Memory</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      {Object.keys(RAM_MB).map((r) => (
                        <button key={r} onClick={() => setRam(r)} style={{ padding: "8px 0", borderRadius: 8, border: `1px solid ${ram === r ? "#7c45ff" : "#2C2C2E"}`, background: ram === r ? "rgba(124,69,255,0.1)" : "transparent", color: ram === r ? "#7c45ff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{r}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>CPU</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {Object.keys(CPU_CORES).map((c) => (
                        <button key={c} onClick={() => setCpu(c)} style={{ padding: "8px 0", borderRadius: 8, border: `1px solid ${cpu === c ? "#7c45ff" : "#2C2C2E"}`, background: cpu === c ? "rgba(124,69,255,0.1)" : "transparent", color: cpu === c ? "#7c45ff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Session ID <span style={{ color: "#4B5563" }}>(optional — gates vault key via EAS attestation)</span></p>
                    <input
                      type="text"
                      placeholder="sess-..."
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2C2C2E", background: "#0A0A0A", color: "#E5E7EB", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #2C2C2E" }}>
                    <p style={{ fontSize: 12, fontFamily: "monospace", color: "#6B7280" }}>
                      {ram} · {cpu} · ~${((RAM_MB[ram] / 1024) * 0.02 + CPU_CORES[cpu] * 0.01).toFixed(2)}/hr
                    </p>
                    <button
                      onClick={handleDeploy}
                      style={{ padding: "10px 24px", borderRadius: 8, background: "#7c45ff", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                    >
                      Deploy 🚀
                    </button>
                  </div>
                </div>
              )}

              {/* ── Stage 4: Deploying ── */}
              {phase === "deploying" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB" }}>Deploying…</p>
                  {[
                    { done: !!workspace, label: "Allocating encrypted workspace" },
                    { done: !!deployResult, label: `Cloning ${repoURL.split("/").slice(-1)[0]}` },
                    { done: !!deployResult, label: `Installing dependencies & starting ${scan?.options[selectedOption]?.framework}` },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {s.done
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      }
                      <span style={{ fontSize: 13, color: s.done ? "#9CA3AF" : "#E5E7EB" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Done ── */}
              {phase === "done" && deployResult && workspace && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#28A745" }}>Deployed Successfully</p>
                  </div>

                  <div style={{ background: "#0A0A0A", border: "1px solid #2C2C2E", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Framework", value: deployResult.framework },
                      { label: "Container", value: deployResult.container_id },
                      { label: "App URL", value: deployResult.app_url, link: true },
                      { label: "Encrypted at", value: workspace.storage_path, mono: true },
                    ].map((r) => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>{r.label}</span>
                        {r.link
                          ? <a href={r.value} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontFamily: "monospace", color: "#7c45ff" }}>{r.value}</a>
                          : <span style={{ fontSize: 12, fontFamily: r.mono ? "monospace" : undefined, color: "#E5E7EB" }}>{r.value}</span>
                        }
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Link
                      href={`/workspaces/${deployResult.container_id}`}
                      style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 8, background: "#7c45ff", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                    >
                      Open Terminal →
                    </Link>
                    <button
                      onClick={() => { setPhase("repo"); setScan(null); setWorkspace(null); setDeployResult(null); setRepoURL(""); }}
                      style={{ padding: "10px 16px", borderRadius: 8, background: "#2A2A2D", color: "#E5E7EB", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                    >
                      Deploy Another
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {phase === "error" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#DC3545" }}>Something went wrong</p>
                  <pre style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280", whiteSpace: "pre-wrap", background: "#0A0A0A", border: "1px solid #2C2C2E", borderRadius: 8, padding: 12 }}>{errMsg}</pre>
                  <button onClick={() => setPhase("repo")} style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8, background: "#2A2A2D", color: "#E5E7EB", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                    ← Try again
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
