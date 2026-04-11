"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MOCK_SESSIONS } from "@/lib/mockData";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
};

type VMConfig = {
  ram: "1gb" | "2gb" | "4gb" | "8gb";
  cpu: "1 core" | "2 core" | "4 core";
};

const RAM_OPTIONS: VMConfig["ram"][] = ["1gb", "2gb", "4gb", "8gb"];
const CPU_OPTIONS: VMConfig["cpu"][] = ["1 core", "2 core", "4 core"];

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export default function DeployPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vmConfig, setVmConfig] = useState<VMConfig>({ ram: "2gb", cpu: "2 core" });
  const [phase, setPhase] = useState<"idle" | "deploying" | "done" | "error">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [teamName, setTeamName] = useState("Your");

  useEffect(() => {
    const storedTeamName = localStorage.getItem("zkloud_team_name");
    if (storedTeamName) setTeamName(storedTeamName);

    // Load projects from sessions
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

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0e0e0e", color: "#d1d5db", fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: "#6b7280" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Dashboard
          </Link>
          <span style={{ color: "#374151" }}>/</span>
          <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>New Deployment</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-1.5 rounded-sm text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#1f2937", color: "#d1d5db", border: "1px solid #374151" }}
          >
            + New project
          </button>
          <button
            className="px-4 py-1.5 rounded-sm text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#5c6e8c", color: "#ffffff" }}
          >
            + New VM
          </button>
        </div>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">
        {/* Two-column layout */}
        <div className="flex gap-6" style={{ minHeight: "420px" }}>

          {/* Left: Project list */}
          <div className="flex-1 rounded-sm" style={{ background: "#181818", border: "1px solid #1f2937" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #1f2937" }}>
              <h2 className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
                <span style={{ color: "#5c6e8c" }}>{teamName}</span>
                {" — "}Projects
              </h2>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {projects.length === 0 && (
                <p className="text-xs py-8 text-center" style={{ color: "#4b5563" }}>No projects found.</p>
              )}
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-colors"
                  style={{
                    background: selectedProjectId === project.id ? "#1f2937" : "transparent",
                    border: `1px solid ${selectedProjectId === project.id ? "#374151" : "transparent"}`,
                  }}
                >
                  {/* Radio */}
                  <div
                    className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{
                      border: `2px solid ${selectedProjectId === project.id ? "#5c6e8c" : "#374151"}`,
                    }}
                  >
                    {selectedProjectId === project.id && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "#5c6e8c" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#e5e7eb" }}>{project.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
                      {project.id.slice(0, 16)}…
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs px-2 py-0.5 rounded-sm"
                    style={{
                      background: project.status === "completed" ? "#052e16" : project.status === "failed" ? "#1c0a0a" : "#1f2937",
                      color: project.status === "completed" ? "#4ade80" : project.status === "failed" ? "#f87171" : "#9ca3af",
                    }}
                  >
                    {project.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: VM Config */}
          <div
            className="rounded-sm p-5 flex flex-col gap-5"
            style={{ width: "220px", background: "#181818", border: "1px solid #1f2937", flexShrink: 0 }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b7280" }}>
                VM Config
              </p>

              {/* RAM */}
              <p className="text-xs mb-2" style={{ color: "#9ca3af" }}>RAM</p>
              <div className="flex flex-col gap-1.5 mb-5">
                {RAM_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setVmConfig((v) => ({ ...v, ram: opt }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm text-left text-xs transition-colors"
                    style={{
                      background: vmConfig.ram === opt ? "#1f2937" : "transparent",
                      border: `1px solid ${vmConfig.ram === opt ? "#5c6e8c" : "#1f2937"}`,
                      color: vmConfig.ram === opt ? "#f3f4f6" : "#6b7280",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: `1.5px solid ${vmConfig.ram === opt ? "#5c6e8c" : "#374151"}` }}
                    >
                      {vmConfig.ram === opt && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5c6e8c" }} />
                      )}
                    </div>
                    {opt}
                  </button>
                ))}
              </div>

              {/* CPU */}
              <p className="text-xs mb-2" style={{ color: "#9ca3af" }}>CPU</p>
              <div className="flex flex-col gap-1.5">
                {CPU_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setVmConfig((v) => ({ ...v, cpu: opt }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm text-left text-xs transition-colors"
                    style={{
                      background: vmConfig.cpu === opt ? "#1f2937" : "transparent",
                      border: `1px solid ${vmConfig.cpu === opt ? "#5c6e8c" : "#1f2937"}`,
                      color: vmConfig.cpu === opt ? "#f3f4f6" : "#6b7280",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: `1.5px solid ${vmConfig.cpu === opt ? "#5c6e8c" : "#374151"}` }}
                    >
                      {vmConfig.cpu === opt && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5c6e8c" }} />
                      )}
                    </div>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Deploy button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleDeploy}
            disabled={!selectedProjectId || phase === "deploying"}
            className="flex flex-col items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div
              className="w-12 h-12 rounded-sm flex items-center justify-center transition-colors"
              style={{
                background: phase === "deploying" ? "#1f2937" : "#5c6e8c",
              }}
            >
              {phase === "deploying" ? (
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
                </svg>
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
              {phase === "deploying" ? "Deploying…" : "Deploy"}
            </span>
          </button>
        </div>

        {/* Status cards */}
        {phase === "done" && sessionId && (
          <div className="mt-6 rounded-sm p-5" style={{ background: "#181818", border: "1px solid #1f2937" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>Deployment started</h3>
            </div>
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              Session <span style={{ fontFamily: "var(--font-space-mono), monospace" }}>{sessionId.slice(0, 20)}…</span> is now running.
            </p>
            <Link
              href={`/sessions/${sessionId}`}
              className="inline-block mt-4 text-xs px-4 py-2 rounded-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "#1f2937", color: "#d1d5db" }}
            >
              View audit log &amp; attestation →
            </Link>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-6 rounded-sm p-4" style={{ background: "#181818", border: "1px solid #1f2937" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ef4444" }}>Deployment failed</h3>
            </div>
            <p className="mt-1 text-xs" style={{ color: "#6b7280", fontFamily: "var(--font-space-mono), monospace" }}>{errMsg || "Backend unavailable — running in demo mode."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
