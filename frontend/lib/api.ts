import { STORAGE } from "@/lib/AuthContext";

// In-browser: route through the Next.js rewrite proxy (/api/backend/...)
// so the browser never crosses origins → no CORS preflight issues.
// On the server (SSR/API routes): call the backend directly.
export const API =
  typeof window !== "undefined"
    ? "/api/backend"
    : (process.env.NEXT_PUBLIC_API_URL ?? "https://backendapi.comput3.xyz");

// WebSocket still needs the real URL (rewrites don't cover ws://)
export const WS_API = (process.env.NEXT_PUBLIC_API_URL ?? "https://backendapi.comput3.xyz").replace(/^http/, "ws");

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE.JWT) ?? "";
}

export function getWallet(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE.WALLET) ?? "";
}

export function authHeaders(): Record<string, string> {
  // No Authorization header — the nginx proxy blocks it in preflight.
  // All authenticated calls use ?wallet= query param instead.
  return {};
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const wallet = getWallet();
  // Append ?wallet= so the backend can authenticate without an Authorization header
  const sep = path.includes("?") ? "&" : "?";
  const url = wallet ? `${API}${path}${sep}wallet=${encodeURIComponent(wallet)}` : `${API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
  });
}

// ── Typed API helpers ──────────────────────────────────────────────────────

export type Session = {
  id: string;
  team_id: string;
  prompt: string;
  state: "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
};

export type SessionLog = {
  id: number;
  session_id: string;
  team_id: string;
  actions: ActionItem[];
  created_at: string;
};

export type ActionItem = {
  index: number;
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
  error?: string;
  timestamp: string;
  hash: string;
};

export type Team = {
  id: string;
  name: string;
  owner: string;
};

export async function createTeam(name: string): Promise<Team> {
  const r = await apiFetch("/teams", { method: "POST", body: JSON.stringify({ name }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createSession(teamId: string, prompt: string, repoUrl?: string): Promise<Session> {
  const r = await apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({ team_id: teamId, prompt, repo_url: repoUrl }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function confirmSession(sessionId: string, approved: boolean): Promise<void> {
  const r = await apiFetch(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function getSession(sessionId: string): Promise<Session> {
  const r = await apiFetch(`/sessions/${sessionId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSessionLog(sessionId: string): Promise<SessionLog> {
  const r = await apiFetch(`/sessions/${sessionId}/log`);
  if (!r.ok) throw new Error(await r.text());
  const raw = await r.json();
  return {
    ...raw,
    actions: typeof raw.actions === "string" ? JSON.parse(raw.actions) : raw.actions ?? [],
  };
}

export async function listSessions(teamId: string): Promise<Session[]> {
  const r = await apiFetch(`/teams/${teamId}/sessions`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

