"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAccount } from "wagmi";
import { API, WS_API, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#e2f0d9";
const ACCENT_FG = "#111111";
const BG = "#111111";
const CARD = "#1a1a1a";
const BORDER = "rgba(255,255,255,0.07)";

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

type PlanContainer = {
  name?: string;
  image?: string;
  ram_mb?: number;
  cpu_cores?: number;
  ports?: string[];
  reason?: string;
};

type PlanData = {
  summary: string;
  estimated_cost_per_hour?: number;
  has_smart_contracts?: boolean;
  status?: string;
  containers?: PlanContainer[];
};

type LiveEvent = {
  type: "plan" | "message" | "action" | "done" | "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  ts: number;
};

// ── helpers ───────────────────────────────────────────────────────────────────

const FRAMEWORK_ICONS: Record<string, string> = {
  nextjs: "▲", react: "⚛", vue: "🟩", sveltekit: "🔥", nuxt: "💚",
  express: "🟨", fastify: "⚡", nestjs: "🐱", fastapi: "🚀", flask: "🌶",
  django: "🎸", go: "🐹", static: "📄",
};

function FrameworkBadge({ opt }: { opt: DeployOption }) {
  const icon = FRAMEWORK_ICONS[opt.framework] ?? "📦";
  const color = opt.type === "frontend" ? ACCENT : "#0ea5e9";
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

// ── types ─────────────────────────────────────────────────────────────────────

type GithubRepo = {
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  updated_at: string;
};

// ── page ──────────────────────────────────────────────────────────────────────

type Phase =
  | "repo" | "repos" | "scanning" | "pick"
  | "prompt" | "creating"
  | "streaming" | "awaiting_confirm" | "building"
  | "done" | "error";

export default function DeployPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { teamId: authTeamId, setTeam } = useAuth();

  const [phase, setPhase] = useState<Phase>("repo");
  const [errMsg, setErrMsg] = useState("");

  // Stage 1 — repo
  const [repoURL, setRepoURL] = useState("");
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubWallet, setGithubWallet] = useState("");

  // Repo picker
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Stage 2 — scan
  const [scan, setScan] = useState<RepoScan | null>(null);
  const [selectedOption, setSelectedOption] = useState<number>(0);

  // Stage 3 — prompt
  const [deployPrompt, setDeployPrompt] = useState("");

  // Stage 4 — session & streaming
  const [sessionId, setSessionId] = useState("");
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [appURL, setAppURL] = useState("");
  const [confirming, setConfirming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      const wallet = params.get("wallet") ?? address ?? "";
      setGithubConnected(true);
      setGithubWallet(wallet);
      router.replace("/deploy");
      // Auto-load repos
      loadRepos(wallet);
    }
  }, [router, address]);

  async function loadRepos(wallet: string) {
    if (!wallet) return;
    setLoadingRepos(true);
    setPhase("repos");
    try {
      const res = await apiFetch(`/auth/github/repos?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) throw new Error(await res.text());
      const data: GithubRepo[] = await res.json();
      setRepos(data);
    } catch {
      // silently fall back — user can still paste URL manually
      setPhase("repo");
    } finally {
      setLoadingRepos(false);
    }
  }

  // Auto-scroll live events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  // Cleanup WS on unmount
  useEffect(() => { return () => { wsRef.current?.close(); }; }, []);

  // ── helpers ─────────────────────────────────────────────────────────────────

  async function ensureTeam(): Promise<string | null> {
    if (authTeamId) return authTeamId;
    const stored = localStorage.getItem("zkloud_team_id");
    if (stored) return stored;
    const name = "team-" + Math.random().toString(36).slice(2, 9);
    const res = await apiFetch(`/teams`, {
      method: "POST",
      body: JSON.stringify({ name, public_key: "" }),
    });
    if (!res.ok) return null;
    const t = await res.json();
    localStorage.setItem("zkloud_team_id", t.id);
    localStorage.setItem("zkloud_team_name", t.name);
    setTeam(t.id, t.name);
    return t.id;
  }

  function connectStream(sid: string) {
    const ws = new WebSocket(`${WS_API}/sessions/${sid}/stream`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        // Message shape from backend:
        // { type: "plan",    plan: {...} }
        // { type: "message", message: "..." }
        // { type: "action",  action: {...} }
        // { type: "done",    ... }
        // { type: "error",   error: "..." }
        const evt = JSON.parse(e.data) as {
          type: string;
          plan?: PlanData;
          message?: string;
          action?: { tool: string; input: unknown; result: unknown; index: number };
          error?: string;
          container_id?: string;
          app_url?: string;
        };

        // Normalise to a single `data` field for the event log
        const evtData =
          evt.type === "plan"    ? evt.plan :
          evt.type === "message" ? (evt.message ?? "") :
          evt.type === "action"  ? evt.action :
          evt.type === "error"   ? (evt.error ?? evt) :
          evt;

        const le: LiveEvent = { type: evt.type as LiveEvent["type"], data: evtData, ts: Date.now() };
        setLiveEvents((prev) => [...prev, le]);

        if (evt.type === "plan") {
          setPlan(evt.plan ?? null);
          setPhase("awaiting_confirm");
        } else if (evt.type === "done") {
          if (evt.container_id) setAppURL(`https://${evt.container_id}.deploy.comput3.xyz`);
          else if (evt.app_url) setAppURL(evt.app_url);
          setPhase("done");
          ws.close();
        } else if (evt.type === "error") {
          setErrMsg(typeof evt.error === "string" ? evt.error : JSON.stringify(evt.error) ?? "Deployment failed");
          setPhase("error");
          ws.close();
        }
      } catch { /* non-JSON frame */ }
    };

    ws.onerror = () => { setErrMsg("WebSocket connection lost"); setPhase("error"); };
    ws.onclose = (e) => {
      if (e.code !== 1000 && !["done","error"].includes(phase)) {
        setErrMsg("Connection closed unexpectedly (code " + e.code + ")");
        setPhase("error");
      }
    };
  }

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!repoURL.trim()) return;
    await runScan(repoURL.trim());
  }

  async function handleDeploy() {
    if (!deployPrompt.trim()) return;
    setPhase("creating");
    setErrMsg("");
    setLiveEvents([]);
    setPlan(null);
    setAppURL("");

    const teamId = await ensureTeam();
    if (!teamId) { setErrMsg("Could not create team. Please try again."); setPhase("error"); return; }

    try {
      const body: Record<string, string> = { team_id: teamId, prompt: deployPrompt };
      if (repoURL.trim()) body.repo_url = repoURL.trim();

      const sessRes = await apiFetch(`/sessions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!sessRes.ok) throw new Error("Session creation failed: " + await sessRes.text());
      const sess = await sessRes.json();
      setSessionId(sess.id);
      setPhase("streaming");
      connectStream(sess.id);
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
    }
  }

  async function handleConfirm(approved: boolean) {
    if (!sessionId) return;
    setConfirming(true);
    try {
      const res = await apiFetch(`/sessions/${sessionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (approved) {
        setPhase("building");
      } else {
        setErrMsg("Deployment cancelled.");
        setPhase("error");
        wsRef.current?.close();
      }
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
    } finally {
      setConfirming(false);
    }
  }

  function handlePickDone() {
    const opt = scan?.options[selectedOption];
    if (opt) {
      setDeployPrompt(`Deploy the ${opt.framework} ${opt.type} on port ${opt.port}. Run: ${opt.install_cmd}. Start with: ${opt.start_cmd}.`);
    } else {
      setDeployPrompt(`Deploy the repo at ${repoURL} and start the application.`);
    }
    setPhase("prompt");
  }

  function resetDeploy() {
    wsRef.current?.close();
    setPhase("repo"); setScan(null); setRepoURL(""); setLiveEvents([]); setPlan(null); setAppURL(""); setSessionId(""); setErrMsg(""); setDeployPrompt("");
  }

  function connectGitHub() {
    if (!address) { alert("Connect your wallet first"); return; }
    window.location.href = `${API}/auth/github?wallet=${address}`;
  }

  async function selectRepo(repo: GithubRepo) {
    const url = repo.clone_url.replace(/\.git$/, "");
    setRepoURL(url);
    await runScan(url);
  }

  async function runScan(url: string) {
    setPhase("scanning");
    setErrMsg("");
    try {
      const res = await apiFetch(`/repos/scan`, {
        method: "POST",
        body: JSON.stringify({ repo_url: url }),
      });
      const text = await res.text();
      if (!res.ok) {
        if (text.includes("private repo") || text.includes("connect GitHub")) {
          throw new Error("🔒 This repo is private. Connect GitHub to authorize access.");
        }
        throw new Error(text);
      }
      const data: RepoScan = JSON.parse(text);
      if (!data.options?.length) {
        // No detection — skip straight to prompt
        setScan(null);
        setDeployPrompt(`Deploy the repo at ${url} on its default port.`);
        setPhase("prompt");
        return;
      }
      setScan(data);
      setSelectedOption(0);
      setPhase("pick");
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
    }
  }

  // ── stage labels ─────────────────────────────────────────────────────────────

  const PHASE_ORDER: Phase[] = ["repo","repos","scanning","pick","prompt","creating","streaming","awaiting_confirm","building","done"];

  function stageStatus(phases: Phase[]) {
    const currentIdx = PHASE_ORDER.indexOf(phase);
    const stageMaxIdx = Math.max(...phases.map((p) => PHASE_ORDER.indexOf(p)));
    const stageMinIdx = Math.min(...phases.map((p) => PHASE_ORDER.indexOf(p)));
    if (phases.includes(phase)) return "active";
    if (currentIdx > stageMaxIdx) return "done";
    if (currentIdx < stageMinIdx) return "pending";
    return "pending";
  }

  const stages = [
    { id: ["repo","repos","scanning"] as Phase[], label: "Connect Repository", sub: repoURL ? repoURL.split("/").slice(-1)[0] : githubConnected ? "GitHub connected" : "Link source code" },
    { id: ["pick"] as Phase[], label: "Detect Stack", sub: scan ? `${scan.options.length} option${scan.options.length !== 1 ? "s" : ""} found` : "Auto-detect framework" },
    { id: ["prompt"] as Phase[], label: "Deployment Prompt", sub: deployPrompt ? deployPrompt.slice(0, 36) + "…" : "Describe what to deploy" },
    { id: ["creating","streaming","awaiting_confirm","building","done"] as Phase[], label: "AI Agent Deploy", sub: phase === "done" ? "Live ✓" : phase === "awaiting_confirm" ? "Awaiting confirmation" : phase === "building" ? "Building…" : ["creating","streaming"].includes(phase) ? "Running…" : "Encrypted container" },
  ];

  const isLivePhase = ["streaming","awaiting_confirm","building"].includes(phase);

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: 'Inter, var(--font-inter), "Inter Fallback", sans-serif', color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "32px" }}>

          {/* Header */}
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: "#F9FAFB", lineHeight: 1.2 }}>New Deployment</p>
              <p style={{ fontSize: 13, fontFamily: "monospace", color: "#6B7280", marginTop: 4 }}>
                AI agent · encrypted container · blockchain-gated
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/sessions" style={{ display: "flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#E5E7EB", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Sessions
              </Link>
              <Link href="/" style={{ display: "flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#E5E7EB", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                ← Dashboard
              </Link>
            </div>
          </header>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              {
                label: "Status",
                value: phase === "creating" ? "Creating…" : isLivePhase ? "Agent running" : phase === "awaiting_confirm" ? "Awaiting confirm" : phase === "done" ? "Live ✓" : phase === "error" ? "Failed" : phase === "scanning" ? "Scanning…" : "Ready",
                accent: ["creating","streaming","building"].includes(phase),
              },
              { label: "Repository", value: repoURL ? repoURL.split("/").slice(-1)[0] || repoURL : "—" },
              { label: "Framework", value: scan?.options[selectedOption]?.framework ?? "—" },
              { label: "Session ID", value: sessionId ? sessionId.slice(5, 20) + "…" : "—" },
            ].map((c) => (
              <div key={c.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>{c.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: c.accent ? ACCENT : "#F9FAFB" }}>{c.value}</p>
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
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: st === "active" ? `${ACCENT}26` : st === "done" ? "rgba(40,167,69,0.15)" : "#1C1C1E",
                      }}>
                        {st === "done"
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          : st === "active"
                          ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT }} />
                          : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4B5563" }} />
                        }
                      </div>
                      {i < stages.length - 1 && <div style={{ width: 1, flex: 1, background: "#2C2C2E", minHeight: 24 }} />}
                    </div>
                    <div style={{ background: st === "active" ? `${ACCENT}14` : "transparent", border: st === "active" ? "1px solid #7c45ff33" : "1px solid transparent", borderRadius: 8, padding: st === "active" ? "10px 12px" : "4px 0", marginBottom: st === "active" ? 4 : 0, paddingBottom: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: st === "active" ? ACCENT : st === "done" ? "#F3F4F6" : "#4B5563" }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: 11, color: st === "done" ? "#28A745" : "#6B7280", marginTop: 2 }}>{s.sub}</p>
                    </div>
                  </div>
                );
              })}
              {sessionId && (
                <div style={{ marginTop: 16, padding: 12, background: "#161618", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Active Session</p>
                  <Link href={`/sessions/${sessionId}`} style={{ fontSize: 12, fontFamily: "monospace", color: ACCENT, textDecoration: "none" }}>
                    {sessionId.slice(0, 28)}…
                  </Link>
                </div>
              )}
            </div>

            {/* Right: active panel */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* ── Stage 1: Connect repo / repo picker ── */}
              {(phase === "repo" || phase === "repos" || phase === "scanning") && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Import Git Repository</p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>
                      {githubConnected ? `Connected as ${githubWallet.slice(0,6)}…${githubWallet.slice(-4)}` : "Connect GitHub for private repos or paste a public URL"}
                    </p>
                  </div>

                  <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
                    {!githubConnected ? (
                      <button onClick={connectGitHub} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8, background: "#21262D", border: "1px solid #30363D", color: "#E5E7EB", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
                        Connect GitHub
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(40,167,69,0.1)", border: "1px solid rgba(40,167,69,0.25)", fontSize: 12, color: "#28A745", fontWeight: 600 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        GitHub Connected
                      </div>
                    )}
                    <input type="text" placeholder="Or paste a URL: https://github.com/owner/repo" value={repoURL} onChange={(e) => setRepoURL(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()} style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: "#E5E7EB", fontSize: 13, outline: "none" }} />
                    <button onClick={handleScan} disabled={!repoURL.trim() || phase === "scanning"} style={{ padding: "9px 18px", borderRadius: 8, background: ACCENT, color: ACCENT_FG, fontSize: 13, fontWeight: 700, border: "none", cursor: !repoURL.trim() ? "default" : "pointer", opacity: !repoURL.trim() ? 0.4 : 1, whiteSpace: "nowrap" }}>
                      {phase === "scanning" ? "Scanning…" : "Import"}
                    </button>
                  </div>

                  <div style={{ padding: "10px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#4B5563" }}>No repo?</span>
                    <button onClick={() => { setDeployPrompt(""); setPhase("prompt"); }} style={{ fontSize: 12, fontWeight: 600, color: ACCENT, background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Create app from prompt only →
                    </button>
                  </div>

                  {githubConnected && (
                    <div style={{ padding: "12px 24px", borderBottom: `1px solid ${BORDER}` }}>
                      <input type="text" placeholder="Search repositories…" value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: "#E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  )}

                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loadingRepos && <div style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading repositories…</div>}
                    {!loadingRepos && githubConnected && repos.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>No repositories found.</div>}
                    {repos.filter((r) => !repoSearch || r.full_name.toLowerCase().includes(repoSearch.toLowerCase())).map((repo) => (
                      <button key={repo.full_name} onClick={() => selectRepo(repo)} disabled={phase === "scanning"} style={{ width: "100%", textAlign: "left", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`, cursor: "pointer", gap: 12 }} onMouseEnter={(e) => (e.currentTarget.style.background = "#161618")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#F3F4F6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.full_name}</p>
                            {repo.description && <p style={{ fontSize: 11, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.description}</p>}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {repo.language && <span style={{ fontSize: 11, color: "#6B7280" }}>{repo.language}</span>}
                          {repo.private && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}>Private</span>}
                          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>Import →</span>
                        </div>
                      </button>
                    ))}
                    {!githubConnected && phase === "repo" && (
                      <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 13 }}>
                        Connect GitHub to see your repositories<br /><span style={{ fontSize: 11 }}>or paste a public URL above</span>
                      </div>
                    )}
                  </div>
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
                      <button key={i} onClick={() => setSelectedOption(i)} style={{ textAlign: "left", padding: 16, borderRadius: 10, border: `1px solid ${selectedOption === i ? ACCENT : "#2C2C2E"}`, background: selectedOption === i ? `${ACCENT}12` : "#0A0A0A", cursor: "pointer" }}>
                        <FrameworkBadge opt={opt} />
                      </button>
                    ))}
                  </div>
                  <button onClick={handlePickDone} style={{ alignSelf: "flex-end", padding: "10px 24px", borderRadius: 8, background: ACCENT, color: ACCENT_FG, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                    Configure Prompt →
                  </button>
                </div>
              )}

              {/* ── Stage 3: Prompt ── */}
              {phase === "prompt" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Deployment Prompt</p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>Tell the AI agent what to deploy. It will create a plan for your confirmation.</p>
                  </div>
                  {repoURL && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: "#0A0A0A", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "#9CA3AF" }}>{repoURL}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Prompt</label>
                    <textarea
                      value={deployPrompt}
                      onChange={(e) => setDeployPrompt(e.target.value)}
                      rows={5}
                      placeholder={repoURL ? `e.g. "Deploy the repo on port 3000. Set NODE_ENV=production."` : `e.g. "Create a Node.js Express API with a /health endpoint on port 3000."`}
                      style={{ padding: "12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: "#E5E7EB", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit" }}
                    />
                    <p style={{ fontSize: 11, color: "#4B5563" }}>The agent will analyze, generate a plan, and wait for your confirmation before building.</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["Deploy on port 3000","Deploy with Docker","Set NODE_ENV=production","Run npm install && npm start"].map((s) => (
                      <button key={s} onClick={() => setDeployPrompt((p) => (p ? p + " " + s + "." : s + "."))} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600, color: "#9CA3AF", background: "#161618", border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                        + {s}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                    <button onClick={() => setPhase(scan ? "pick" : "repo")} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                      ← Back
                    </button>
                    <button onClick={handleDeploy} disabled={!deployPrompt.trim()} style={{ padding: "10px 24px", borderRadius: 8, background: ACCENT, color: ACCENT_FG, fontSize: 13, fontWeight: 700, border: "none", cursor: !deployPrompt.trim() ? "default" : "pointer", opacity: !deployPrompt.trim() ? 0.4 : 1 }}>
                      Launch Agent 🚀
                    </button>
                  </div>
                </div>
              )}

              {/* ── Creating session ── */}
              {phase === "creating" && (
                <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <p style={{ fontSize: 14, color: "#9CA3AF" }}>Creating deployment session…</p>
                </div>
              )}

              {/* ── Live Streaming / Awaiting Confirm / Building ── */}
              {isLivePhase && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400 }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase === "awaiting_confirm" ? "#eab308" : ACCENT }} className="animate-pulse" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>
                        {phase === "awaiting_confirm" ? "Plan Ready — Confirm to Proceed" : phase === "building" ? "Building Deployment…" : "Agent Running"}
                      </span>
                    </div>
                    <Link href={`/sessions/${sessionId}`} style={{ fontSize: 11, color: "#6B7280", textDecoration: "none" }}>View full session →</Link>
                  </div>

                  {/* Plan confirmation */}
                  {phase === "awaiting_confirm" && plan && (
                    <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, background: "#0e1117" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#eab308", marginBottom: 10 }}>📋 Deployment Plan</p>
                      <p style={{ fontSize: 13, color: "#D1D5DB", marginBottom: 12, lineHeight: 1.5 }}>{plan.summary}</p>
                      {plan.containers && plan.containers.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                          {plan.containers.map((c, i) => (
                            <div key={i} style={{ display: "flex", gap: 8, padding: "8px 12px", borderRadius: 6, background: "#161618", border: `1px solid ${BORDER}` }}>
                              {c.name && <span style={{ fontSize: 12, fontFamily: "monospace", color: ACCENT, minWidth: 80 }}>{c.name}</span>}
                              {c.image && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#6B7280" }}>{c.image}</span>}
                              {c.reason && !c.name && <span style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>{c.reason}</span>}
                              {c.ram_mb != null && <span style={{ marginLeft: "auto", fontSize: 11, color: "#4B5563" }}>{c.ram_mb}MB · {c.cpu_cores} cpu</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {plan.estimated_cost_per_hour !== undefined && (
                        <p style={{ fontSize: 12, color: "#4B5563", marginBottom: 12 }}>Estimated: ~${plan.estimated_cost_per_hour.toFixed(3)}/hr</p>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => handleConfirm(true)} disabled={confirming} style={{ flex: 1, padding: "10px", borderRadius: 8, background: ACCENT, color: ACCENT_FG, fontSize: 13, fontWeight: 700, border: "none", cursor: confirming ? "default" : "pointer", opacity: confirming ? 0.6 : 1 }}>
                          {confirming ? "Confirming…" : "✓ Approve & Deploy"}
                        </button>
                        <button onClick={() => handleConfirm(false)} disabled={confirming} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(220,53,69,0.1)", color: "#DC3545", fontSize: 13, fontWeight: 700, border: "1px solid rgba(220,53,69,0.3)", cursor: confirming ? "default" : "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live event log */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 16, fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 4, background: "#0A0A0A" }}>
                    {liveEvents.length === 0 && <p style={{ color: "#4B5563" }}>Waiting for agent events…</p>}
                    {liveEvents.map((evt, i) => {
                      const color = evt.type === "plan" ? "#eab308" : evt.type === "done" ? "#22c55e" : evt.type === "error" ? "#ef4444" : evt.type === "action" ? "#60a5fa" : "#9CA3AF";
                      const prefix = evt.type === "plan" ? "📋 plan " : evt.type === "done" ? "✓ done " : evt.type === "error" ? "✗ error " : evt.type === "action" ? "⚡ " : "· ";
                      let text: string;
                      if (evt.type === "message") {
                        text = typeof evt.data === "string" ? evt.data : (evt.data != null ? JSON.stringify(evt.data) : "");
                      } else if (evt.type === "plan") {
                        text = (evt.data as PlanData)?.summary ?? "Plan received";
                      } else if (evt.type === "action") {
                        const a = evt.data as { tool?: string; input?: unknown };
                        text = a?.tool ? `${a.tool}` + (a.input ? ` — ${JSON.stringify(a.input).slice(0, 80)}` : "") : JSON.stringify(evt.data);
                      } else if (evt.type === "done") {
                        text = "Deployment complete";
                      } else if (evt.type === "error") {
                        text = typeof evt.data === "string" ? evt.data : JSON.stringify(evt.data);
                      } else {
                        text = evt.data != null ? JSON.stringify(evt.data) : "";
                      }
                      if (!text) return null;
                      return (
                        <div key={i} style={{ color, lineHeight: 1.5 }}>
                          <span style={{ color: "#374151" }}>{new Date(evt.ts).toLocaleTimeString()} </span>
                          <span style={{ fontWeight: 600 }}>{prefix}</span>
                          <span style={{ color: "#D1D5DB" }}>{String(text)}</span>
                        </div>
                      );
                    })}
                    <div ref={eventsEndRef} />
                  </div>
                </div>
              )}

              {/* ── Done ── */}
              {phase === "done" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#28A745" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#28A745" }}>Deployment Successful</p>
                  </div>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>Session ID</span>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "#E5E7EB" }}>{sessionId}</span>
                    </div>
                    {appURL && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>App URL</span>
                        <a href={appURL} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontFamily: "monospace", color: ACCENT }}>{appURL}</a>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {appURL && (
                      <a href={appURL} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 8, background: ACCENT, color: ACCENT_FG, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        Open App ↗
                      </a>
                    )}
                    <Link href={`/sessions/${sessionId}`} style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.07)", color: "#E5E7EB", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      View Session Log
                    </Link>
                    <button onClick={resetDeploy} style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                      Deploy Again
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {phase === "error" && (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#DC3545" }}>
                    {errMsg.includes("private") ? "🔒 Private Repository" : "Something went wrong"}
                  </p>
                  <pre style={{ fontSize: 12, fontFamily: "monospace", color: "#9CA3AF", whiteSpace: "pre-wrap", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>{errMsg}</pre>
                  <div style={{ display: "flex", gap: 8 }}>
                    {errMsg.includes("private") && (
                      <button onClick={connectGitHub} style={{ padding: "8px 16px", borderRadius: 8, background: "#21262D", color: "#E5E7EB", fontSize: 13, fontWeight: 600, border: "1px solid #30363D", cursor: "pointer" }}>
                        Connect GitHub
                      </button>
                    )}
                    <button onClick={resetDeploy} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#E5E7EB", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                      ← Try again
                    </button>
                    {sessionId && (
                      <Link href={`/sessions/${sessionId}`} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, textDecoration: "none", border: `1px solid ${BORDER}` }}>
                        View Session
                      </Link>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

