import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { clearToken, getToken, saveToken } from "../api/client";

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken()
      .then(setToken)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      loading,
      signIn: async (newToken: string) => {
        await saveToken(newToken);
        setToken(newToken);
      },
      signOut: async () => {
        await clearToken();
        setToken(null);
      },
    }),
    [token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
