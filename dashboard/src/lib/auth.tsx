"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Agent } from "./api";

const OPEN_API_BASE =
  process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

interface AuthState {
  apiKey: string | null;
  agent: Agent | null;
  loading: boolean;
  login: (key: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  apiKey: null,
  agent: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (key: string): Promise<Agent> => {
    const res = await fetch(`${OPEN_API_BASE}/v1/agents/me`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error("Invalid API key");
    return res.json();
  }, []);

  const login = useCallback(
    async (key: string) => {
      const me = await fetchMe(key);
      setApiKey(key);
      setAgent(me);
      localStorage.setItem("gt8004_api_key", key);
    },
    [fetchMe]
  );

  const logout = useCallback(() => {
    setApiKey(null);
    setAgent(null);
    localStorage.removeItem("gt8004_api_key");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("gt8004_api_key");
    if (!stored) {
      setLoading(false);
      return;
    }
    fetchMe(stored)
      .then((me) => {
        setApiKey(stored);
        setAgent(me);
      })
      .catch(() => {
        localStorage.removeItem("gt8004_api_key");
      })
      .finally(() => setLoading(false));
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ apiKey, agent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
