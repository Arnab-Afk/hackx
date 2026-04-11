"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOCK_SESSIONS } from "@/lib/mockData";
import { Sidebar } from "@/components/Sidebar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
};

type VMConfig = {
  ram: "1GB" | "2GB" | "4GB" | "8GB";
  cpu: "1 core" | "2 core" | "4 core";
};

const RAM_OPTIONS: VMConfig["ram"][] = ["1GB", "2GB", "4GB", "8GB"];
const CPU_OPTIONS: VMConfig["cpu"][] = ["1 core", "2 core", "4 core"];

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "\u2026" : str;
}

const statusMeta: Record<string, { dot: string; text: string; bg: string }> = {
  completed: { dot: "#28A745", text: "#28A745", bg: "rgba(40,167,69,0.1)" },
  failed:    { dot: "#DC3545", text: "#DC3545", bg: "rgba(220,53,69,0.1)" },
  default:   { dot: "#6B7280", text: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};
function getSm(s: string) { return statusMeta[s] ?? statusMeta.default; }

export default function DeployPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vmConfig, setVmConfig] = useState<VMConfig>({ ram: "2GB", cpu: "2 core" });
  const [phase, setPhase] = useState<"idle" | "deploying" | "done" | "error">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [teamName, setTeamName] = useState("Your");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubConnected, setGithubConnected] = useState(false);
  const [repoInput, setRepoInput] = useState("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  useEffect(() => {
    const storedTeamName = localStorage.getItem("zkloud_team_name");
    if (storedTeamName) setTeamName(storedTeamName);

    const sessionIds: string[] = JSON.parse(localStorage.getItem("comput3_sessions") ?? "[]");
    if (sessionIds.length > 0) {
      Promise.all(
        sessionIds.slice(0, 10).map((id) =>
          fetch(`${API}/sessions/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      ).then((results) => {
        const real = results.filter(Boolean);
        if (real.length > 0) {
          setProjects(
            real.map((s: { id: string; prompt: string; state: string }) => ({
              id: s.id,
              name: truncate(s.prompt, 40),
              description: s.prompt,
              status: s.state,
            }))
          );
        } else {
          setProjects(
            MOCK_SESSIONS.map((s) => ({
              id: s.id,
              name: truncate(s.prompt, 40),
              description: s.prompt,
              status: s.state,
            }))
          );
        }
      });
    } else {
      setProjects(
        MOCK_SESSIONS.map((s) => ({
          id: s.id,
          name: truncate(s.prompt, 40),
          description: s.prompt,
          status: s.state,
        }))
      );
    }
  }, []);

  async function handleDeploy() {
    if (!selectedProjectId) return;
    setPhase("deploying");
    setErrMsg("");

    let teamId = localStorage.getItem("zkloud_team_id");
    if (!teamId) {
      const name = "team-" + Math.random().toString(36).slice(2, 9);
      try {
        const res = await fetch(`${API}/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, public_key: "" }),
        });
        const t = await res.json();
        localStorage.setItem("zkloud_team_id", t.id);
        localStorage.setItem("zkloud_team_name", t.name);
        teamId = t.id;
      } catch {
        setPhase("error");
        setErrMsg("Failed to register team. Is the backend running?");
        return;
      }
    }

    const project = projects.find((p) => p.id === selectedProjectId);
    try {
      const res = await fetch(`${API}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          prompt: project?.description ?? "",
          vm_config: { ram: vmConfig.ram, cpu: vmConfig.cpu },
          github_repo: githubConnected ? githubRepo : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const sess = await res.json();
      setSessionId(sess.id);
      try {
        const existing: string[] = JSON.parse(localStorage.getItem("comput3_sessions") ?? "[]");
        const updated = [sess.id, ...existing.filter((id) => id !== sess.id)].slice(0, 50);
        localStorage.setItem("comput3_sessions", JSON.stringify(updated));
      } catch { /* ignore */ }
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setErrMsg(String(e));
    }
  }

  const pipelineId = "pl_" + Math.random().toString(36).slice(2, 14);

  return (
    <div className="flex h-screen" style={{ background: "#0A0A0A", fontFamily: "Inter, var(--font-inter), sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          {/* Page header */}
          <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <p className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#F9FAFB" }}>New Deployment</p>
              <p className="text-sm font-mono" style={{ color: "#6B7280" }}>
                ID: {pipelineId}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="flex items-center justify-center rounded-lg h-10 px-4 text-sm font-bold"
                style={{ background: "#2A2A2D", color: "#E5E7EB" }}
              >
                ← Dashboard
              </Link>
              <button
                onClick={handleDeploy}
                disabled={!selectedProjectId || phase === "deploying"}
                className="flex items-center justify-center rounded-lg h-10 px-4 text-sm font-black disabled:opacity-30"
                style={{ background: "#7c45ff", color: "#000" }}
              >
                {phase === "deploying" ? (
                  <svg className="animate-spin mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : null}
                {phase === "deploying" ? "Deploying\u2026" : "Deploy Pipeline"}
              </button>
              {phase === "idle" && selectedProjectId && (
                <button
                  onClick={() => { setPhase("idle"); setSelectedProjectId(null); }}
                  className="flex items-center justify-center rounded-lg h-10 px-4 text-sm font-bold"
                  style={{ background: "#DC3545", color: "#fff" }}
                >
                  Abort
                </button>
              )}
            </div>
          </header>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Overall Status", value: phase === "deploying" ? "Running" : phase === "done" ? "Succeeded" : phase === "error" ? "Failed" : "Ready", accent: phase === "deploying" },
              { label: "Repository", value: githubConnected ? githubRepo.split("/").slice(-1)[0] || "—" : "Not connected" },
              { label: "VM Config", value: vmConfig.ram + " / " + vmConfig.cpu },
              { label: "Triggered By", value: teamName },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
                <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{s.label}</p>
                <p className="text-xl font-bold leading-tight flex items-center gap-2 truncate" style={{ color: s.accent ? "#7c45ff" : "#F9FAFB" }}>
                  {s.accent && (
                    <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                  )}
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Pipeline stages */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <h2 className="text-xl font-bold" style={{ color: "#F9FAFB" }}>Pipeline Stages</h2>

              {/* Stage 1: Connect GitHub */}
              <div
                className="grid grid-cols-[auto_1fr] gap-x-4"
              >
                {/* Stage: Connect GitHub */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex items-center justify-center rounded-full p-1.5"
                    style={{
                      color: githubConnected ? "#28A745" : "#7c45ff",
                      background: githubConnected ? "rgba(40,167,69,0.15)" : "rgba(124,69,255,0.15)",
                    }}
                  >
                    {githubConnected ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                    )}
                  </div>
                  <div className="w-0.5 grow" style={{ background: "#2C2C2E" }} />
                </div>
                <div className="flex flex-col pb-5 pl-1"
                  style={!githubConnected ? { background: "#161618", border: "1px solid #7c45ff", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px" } : {}}
                >
                  <p className="text-sm font-bold" style={{ color: !githubConnected ? "#7c45ff" : "#F3F4F6" }}>
                    Connect GitHub Repository
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: githubConnected ? "#28A745" : "#9CA3AF" }}>
                    {githubConnected ? `Connected: ${githubRepo}` : "Link your source code"}
                  </p>
                </div>

                {/* Stage: Select Project */}
                <div className="flex flex-col items-center gap-1">
                  {githubConnected ? (
                    <div className="flex items-center justify-center rounded-full p-1.5" style={{ color: selectedProjectId ? "#28A745" : "#7c45ff", background: selectedProjectId ? "rgba(40,167,69,0.15)" : "rgba(124,69,255,0.15)" }}>
                      {selectedProjectId
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c45ff" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      }
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-full p-1.5" style={{ color: "#6B7280", background: "#2A2A2D" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="1"/></svg>
                    </div>
                  )}
                  <div className="w-0.5 grow" style={{ background: "#2C2C2E" }} />
                </div>
                <div className="flex flex-col pb-5 pl-1">
                  <p className="text-sm font-medium" style={{ color: githubConnected ? "#F3F4F6" : "#6B7280" }}>Select Project</p>
                  <p className="text-xs mt-0.5" style={{ color: selectedProjectId ? "#28A745" : "#9CA3AF" }}>
                    {selectedProjectId ? truncate(selectedProject?.description ?? "", 36) : "Choose from your sessions"}
                  </p>
                </div>

                {/* Stage: Configure VM */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center rounded-full p-1.5" style={{
                    color: selectedProjectId ? "#28A745" : "#6B7280",
                    background: selectedProjectId ? "rgba(40,167,69,0.15)" : "#2A2A2D",
                  }}>
                    {selectedProjectId
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="1"/></svg>
                    }
                  </div>
                </div>
                <div className="flex flex-col pl-1">
                  <p className="text-sm font-medium" style={{ color: selectedProjectId ? "#F3F4F6" : "#6B7280" }}>Configure VM</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{vmConfig.ram} / {vmConfig.cpu}</p>
                </div>
              </div>
            </div>

            {/* Right: Config panel with tabs */}
            <div className="lg:col-span-2 rounded-xl overflow-hidden flex flex-col" style={{ background: "#161618", border: "1px solid #2C2C2E" }}>
              <div className="flex" style={{ borderBottom: "1px solid #2C2C2E" }}>
                <button className="px-4 py-3 text-white text-sm font-semibold" style={{ borderBottom: "2px solid #7c45ff" }}>Config</button>
                <button className="px-4 py-3 text-sm font-medium" style={{ color: "#6B7280" }}>Details</button>
                <button className="px-4 py-3 text-sm font-medium" style={{ color: "#6B7280" }}>Audit Trail</button>
              </div>

              <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">

                {/* GitHub Repository */}
                <div className="rounded-xl p-5" style={{ background: "#0A0A0A", border: "1px solid #2C2C2E" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1C1C1E" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="1.8">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#F9FAFB" }}>GitHub Repository</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>Connect your source code repository</p>
                    </div>
                    {githubConnected && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: "#28A745", background: "rgba(40,167,69,0.12)", border: "1px solid rgba(40,167,69,0.25)" }}>
                        Connected
                      </span>
                    )}
                  </div>

                  {!githubConnected ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://github.com/owner/repo"
                          value={repoInput}
                          onChange={(e) => setRepoInput(e.target.value)}
                          className="flex-1 text-sm px-3 py-2.5 rounded-lg outline-none"
                          style={{
                            background: "#161618",
                            border: "1px solid #2C2C2E",
                            color: "#E5E7EB",
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#7c45ff")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#2C2C2E")}
                        />
                        <button
                          onClick={() => { if (repoInput.trim()) { setGithubRepo(repoInput.trim()); setGithubConnected(true); } }}
                          className="px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap"
                          style={{ background: "#7c45ff", color: "#000" }}
                        >
                          Connect
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px" style={{ background: "#2C2C2E" }} />
                        <span className="text-xs" style={{ color: "#4B5563" }}>or</span>
                        <div className="flex-1 h-px" style={{ background: "#2C2C2E" }} />
                      </div>
                      <button
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium"
                        style={{ background: "#21262D", color: "#E5E7EB", border: "1px solid #30363D" }}
                        onClick={() => {
                          const demoRepo = "https://github.com/demo/my-app";
                          setRepoInput(demoRepo);
                          setGithubRepo(demoRepo);
                          setGithubConnected(true);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                        </svg>
                        Authorize with GitHub
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#161618", border: "1px solid rgba(40,167,69,0.2)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        <span className="text-sm font-mono truncate" style={{ color: "#9CA3AF" }}>{githubRepo}</span>
                      </div>
                      <button
                        onClick={() => { setGithubConnected(false); setRepoInput(""); setGithubRepo(""); }}
                        className="text-xs ml-3 shrink-0"
                        style={{ color: "#6B7280" }}
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>

                {/* Project selector */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2C2C2E" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}>
                    <p className="text-xs font-mono font-semibold uppercase tracking-widest" style={{ color: "#6B7280" }}>SELECT PROJECT</p>
                  </div>
                  <div className="py-1">
                    {projects.map((project) => {
                      const sm = getSm(project.status ?? "");
                      const isSelected = project.id === selectedProjectId;
                      return (
                        <button
                          key={project.id}
                          onClick={() => setSelectedProjectId(project.id)}
                          className="w-full text-left px-5 py-3 flex items-center gap-3 transition-all"
                          style={{
                            background: isSelected ? "rgba(124,69,255,0.06)" : "transparent",
                            borderLeft: isSelected ? "2px solid #7c45ff" : "2px solid transparent",
                          }}
                        >
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                          <span className="text-sm flex-1 truncate" style={{ color: isSelected ? "#E5E7EB" : "#6B7280" }}>
                            {truncate(project.description ?? project.name, 55)}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: sm.text, background: sm.bg }}>
                            {project.status ?? "unknown"}
                          </span>
                        </button>
                      );
                    })}
                    {projects.length === 0 && (
                      <p className="px-5 py-4 text-sm" style={{ color: "#4B5563" }}>No projects found.</p>
                    )}
                  </div>
                </div>

                {/* VM Config */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2C2C2E" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid #2C2C2E", background: "#0A0A0A" }}>
                    <p className="text-xs font-mono font-semibold uppercase tracking-widest" style={{ color: "#6B7280" }}>VM CONFIGURATION</p>
                  </div>
                  <div className="p-5 flex flex-col gap-5">
                    <div>
                      <p className="text-sm font-medium mb-3" style={{ color: "#9CA3AF" }}>Memory</p>
                      <div className="grid grid-cols-4 gap-2">
                        {RAM_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVmConfig((c) => ({ ...c, ram: opt }))}
                            className="py-2 text-sm font-medium rounded-lg transition-all"
                            style={{
                              borderRadius: "8px",
                              border: vmConfig.ram === opt ? "1px solid #7c45ff" : "1px solid #2C2C2E",
                              background: vmConfig.ram === opt ? "rgba(124,69,255,0.1)" : "transparent",
                              color: vmConfig.ram === opt ? "#7c45ff" : "#6B7280",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-3" style={{ color: "#9CA3AF" }}>CPU Cores</p>
                      <div className="grid grid-cols-3 gap-2">
                        {CPU_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVmConfig((c) => ({ ...c, cpu: opt }))}
                            className="py-2 text-sm font-medium rounded-lg transition-all"
                            style={{
                              borderRadius: "8px",
                              border: vmConfig.cpu === opt ? "1px solid #7c45ff" : "1px solid #2C2C2E",
                              background: vmConfig.cpu === opt ? "rgba(124,69,255,0.1)" : "transparent",
                              color: vmConfig.cpu === opt ? "#7c45ff" : "#6B7280",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 flex justify-between" style={{ borderTop: "1px solid #2C2C2E" }}>
                      <p className="text-xs font-mono" style={{ color: "#6B7280" }}>Selected: {vmConfig.ram} · {vmConfig.cpu}</p>
                      <p className="text-xs font-mono" style={{ color: "#4B5563" }}>~$0.08/hr</p>
                    </div>
                  </div>
                </div>

                {/* Status banners */}
                {phase === "done" && (
                  <div className="flex items-start gap-3 px-5 py-4 rounded-xl" style={{ background: "rgba(40,167,69,0.06)", border: "1px solid rgba(40,167,69,0.2)" }}>
                    <span className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: "#28A745" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#28A745" }}>Deployment initiated</p>
                      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                        Session ID: <span className="font-mono">{sessionId?.slice(0, 16)}…</span> — your container is spinning up.
                      </p>
                    </div>
                  </div>
                )}
                {phase === "error" && (
                  <div className="flex items-start gap-3 px-5 py-4 rounded-xl" style={{ background: "rgba(220,53,69,0.06)", border: "1px solid rgba(220,53,69,0.2)" }}>
                    <span className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: "#DC3545" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#DC3545" }}>Deployment failed</p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "#6B7280" }}>{errMsg}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
