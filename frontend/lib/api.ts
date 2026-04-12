export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
export const WS_API = API.replace(/^http/, "ws");

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("comput3_jwt") ?? "";
}

export function getWallet(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("comput3_wallet") ?? "";
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      ...authHeaders(),
    },
  });
}
