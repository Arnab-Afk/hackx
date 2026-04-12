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
// Token helpers — supports both standard JWT and custom wallet|exp|hmac
// -------------------------------------------------------------------
function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  // Standard JWT: header.payload.signature
  if (token.includes(".") && token.split(".").length === 3) {
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (!decoded.exp) return true; // no expiry claim = treat as valid
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
  // Legacy custom format: wallet|exp_unix|hmac_hex
  const parts = token.split("|");
  if (parts.length === 3) {
    const exp = parseInt(parts[1], 10);
    return !isNaN(exp) && exp * 1000 > Date.now();
  }
  return false;
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
  isAuthenticating: boolean;
  teamId: string | undefined;
  teamName: string | undefined;
  isNewAccount: boolean;
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
  isAuthenticating: false,
  teamId: undefined,
  teamName: undefined,
  isNewAccount: false,
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
  // Tracks address for which auto-auth was already triggered this session,
  // preventing repeated MetaMask popups when wagmi re-renders.
  const autoAuthTriggeredFor = useRef<string>("");

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

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(false);

  const isAuthenticated = isTokenValid(token);

  // ----- fetchAccount — called after getting a valid token ---------------
  const fetchAccount = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API}/account`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return;
      const account = await res.json();
      const defaultName = account.name?.startsWith("account-");
      localStorage.setItem(STORAGE.TEAM_ID, account.id);
      localStorage.setItem(STORAGE.TEAM_NAME, account.name ?? "");
      setTeamIdState(account.id);
      setTeamNameState(account.name);
      setIsNewAccount(!!defaultName);
    } catch {
      // Non-fatal — user is still authenticated, just no teamId yet
    }
  }, []);

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
    localStorage.removeItem(STORAGE.TEAM_ID);
    localStorage.removeItem(STORAGE.TEAM_NAME);
    setTokenState(undefined);
    setTeamIdState(undefined);
    setTeamNameState(undefined);
    setIsNewAccount(false);
    autoAuthTriggeredFor.current = "";
  }, []);

  // ----- authenticate ----------------------------------------------------
  const authenticate = useCallback(async () => {
    if (!address || authInFlight.current) return;
    authInFlight.current = true;
    setIsAuthenticating(true);

    // Mark this wallet immediately so we don't re-trigger on next render
    localStorage.setItem(STORAGE.WALLET, address.toLowerCase());

    try {
      const nonceRes = await fetch(`${API}/auth/nonce?wallet=${encodeURIComponent(address)}`);
      if (!nonceRes.ok) return;
      const { nonce } = await nonceRes.json();

      const message = `Sign in to COMPUT3\n\nAddress: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nonce, signature }),
      });
      if (!verifyRes.ok) return;
      const { token: t } = await verifyRes.json();

      localStorage.setItem(STORAGE.JWT, t);
      localStorage.setItem(STORAGE.WALLET, address.toLowerCase());
      setTokenState(t);

      // Auto-create / load account for this wallet
      await fetchAccount(t);
    } catch {
      // Wallet rejection or network error — silently ignore
    } finally {
      authInFlight.current = false;
      setIsAuthenticating(false);
    }
  }, [address, signMessageAsync, fetchAccount]);

  // ----- Auto-authenticate on wallet connect / change --------------------
  useEffect(() => {
    if (!isConnected || !address) {
      // Reset tracker when wallet disconnects so re-connecting works
      autoAuthTriggeredFor.current = "";
      return;
    }

    const storedWallet = localStorage.getItem(STORAGE.WALLET);
    const walletMatches = storedWallet === address.toLowerCase();
    const storedToken = localStorage.getItem(STORAGE.JWT);
    const storedTeamId = localStorage.getItem(STORAGE.TEAM_ID);

    if (!walletMatches || !isTokenValid(storedToken ?? undefined)) {
      // Only trigger MetaMask once per address; wagmi can re-render this
      // effect many times during the connection handshake.
      if (autoAuthTriggeredFor.current !== address.toLowerCase()) {
        autoAuthTriggeredFor.current = address.toLowerCase();
        authenticate();
      }
    } else if (storedToken && !token) {
      // Wallet matches and token is valid — just hydrate state
      setTokenState(storedToken);
      // Also load account if teamId is missing
      if (!storedTeamId) {
        fetchAccount(storedToken);
      }
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
        isAuthenticating,
        teamId,
        teamName,
        isNewAccount,
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
