import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "../types";

const TOKEN_KEY = "obra_token";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  isMaster: boolean;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const loadMe = useCallback(async (t: string) => {
    const r = await fetch(`${import.meta.env.VITE_API_BASE ?? ""}/api/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return;
    }
    const u = (await r.json()) as User;
    setUser(u);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    let on = true;
    setLoading(true);
    loadMe(token).finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [token, loadMe]);

  const setSession = useCallback((t: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      setSession,
      logout,
      isMaster: !!user?.is_master,
    }),
    [user, token, loading, setSession, logout]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
