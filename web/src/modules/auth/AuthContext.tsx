import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import type { Role } from "@/lib/roles";

export interface AuthUser {
  user_id: string;
  full_name: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hms_user");
    const token = localStorage.getItem("hms_token");
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const { data } = await apiClient.post("/api/auth/login", { email, password });
    const authUser: AuthUser = { user_id: data.user_id, full_name: data.full_name, role: data.role };
    localStorage.setItem("hms_token", data.access_token);
    localStorage.setItem("hms_user", JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  }

  function logout() {
    localStorage.removeItem("hms_token");
    localStorage.removeItem("hms_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
