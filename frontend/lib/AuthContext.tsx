"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// -------------------------------------------------------------------
// Token helpers — custom format: wallet|exp_unix|hmac_hex
// -------------------------------------------------------------------
function parseCustomToken(token: string): { wallet: string; exp: number } | null {
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const exp = parseInt(parts[1], 10);
  if (isNaN(exp)) return null;
  return { wallet: parts[0], exp };
}

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const parsed = parseCustomToken(token);
  if (!parsed) return false;
  return parsed.exp * 1000 > Date.now();
}

// -------------------------------------------------------------------
// Storage keys — single source of truth
// -------------------------------------------------------------------
export const STORAGE = {
  JWT:        "comput3_jwt",
  WALLET:     "comput3_wallet",
  TEAM_ID:    "zkloud_team_id",
  TEAM_NAME:  "zkloud_team_name",
  WORKSPACES: "zkloud_workspaces",
} as const;

// -------------------------------------------------------------------
// Context type
// -------------------------------------------------------------------
type AuthState = {
  address: string | undefined;
  isConnected: boolean;
  token: string | undefined;
  isAuthenticated: boolean;
  teamId: string | undefined;
  teamName: string | undefined;
  authenticate: () => Promise<void>;
  setTeam: (id: string, name?: string) => void;
  addWorkspace: (containerId: string) => void;
  logout: () => void;
};

const DEFAULT: AuthState = {
  address: undefined,
  isConnected: false,
  token: undefined,
  isAuthenticated: false,
  teamId: undefined,
  teamName: undefined,
  authenticate: async () => {},
  setTeam: () => {},
  addWorkspace: () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthState>(DEFAULT);

// -------------------------------------------------------------------
// Provider
// -------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const authInFlight = useRef(false);

  // Initialize from localStorage synchronously (runs only on client)
  const [token, setTokenState] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const t = localStorage.getItem(STORAGE.JWT) ?? undefined;
    return isTokenValid(t) ? t : undefined;
  });

  const [teamId, setTeamIdState] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(STORAGE.TEAM_ID) ?? undefined;
  });

  const [teamName, setTeamNameState] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(STORAGE.TEAM_NAME) ?? undefined;
  });

  const isAuthenticated = isTokenValid(token);

  // ----- setTeam ---------------------------------------------------------
  const setTeam = useCallback((id: string, name?: string) => {
    localStorage.setItem(STORAGE.TEAM_ID, id);
    if (name) localStorage.setItem(STORAGE.TEAM_NAME, name);
    setTeamIdState(id);
    if (name) setTeamNameState(name);
  }, []);

  // ----- addWorkspace ----------------------------------------------------
  const addWorkspace = useCallback((containerId: string) => {
    const hist: string[] = JSON.parse(localStorage.getItem(STORAGE.WORKSPACES) ?? "[]");
    localStorage.setItem(STORAGE.WORKSPACES, JSON.stringify([containerId, ...hist].slice(0, 20)));
  }, []);

  // ----- logout ----------------------------------------------------------
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE.JWT);
    localStorage.removeItem(STORAGE.WALLET);
    setTokenState(undefined);
  }, []);

  // ----- authenticate ----------------------------------------------------
  const authenticate = useCallback(async () => {
    if (!address || authInFlight.current) return;
    authInFlight.current = true;

    // Mark this wallet immediately so we don't re-trigger on next render
    localStorage.setItem(STORAGE.WALLET, address.toLowerCase());

    try {
      const nonceRes = await fetch(`${API}/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) return;
      const { nonce } = await nonceRes.json();

      const message = `Sign in to COMPUT3\n\nAddress: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) return;
      const { token: t } = await verifyRes.json();

      localStorage.setItem(STORAGE.JWT, t);
      localStorage.setItem(STORAGE.WALLET, address.toLowerCase());
      setTokenState(t);
    } catch {
      // Wallet rejection or network error — silently ignore
    } finally {
      authInFlight.current = false;
    }
  }, [address, signMessageAsync]);

  // ----- Auto-authenticate on wallet connect / change --------------------
  useEffect(() => {
    if (!isConnected || !address) return;

    const storedWallet = localStorage.getItem(STORAGE.WALLET);
    const walletMatches = storedWallet === address.toLowerCase();

    const storedToken = localStorage.getItem(STORAGE.JWT);

    if (!walletMatches || !isTokenValid(storedToken ?? undefined)) {
      // Need fresh auth
      authenticate();
    } else if (storedToken && !token) {
      // Wallet matches and token is valid — just hydrate state
      setTokenState(storedToken);
    }
  }, [isConnected, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Clear token when wallet disconnects -----------------------------
  useEffect(() => {
    if (!isConnected) {
      setTokenState(undefined);
    }
  }, [isConnected]);

  return (
    <AuthContext.Provider
      value={{
        address,
        isConnected,
        token,
        isAuthenticated,
        teamId,
        teamName,
        authenticate,
        setTeam,
        addWorkspace,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
