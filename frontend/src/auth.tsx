import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { api, setUnauthorizedHandler, TOKEN_KEY } from "@/src/api";

export type Perm = "booking" | "expense" | "reports";
export type User = { id: string; name: string; role: "staff" | "admin" | "super_admin"; sub_role: string; permissions?: Record<Perm, boolean> };

type Ctx = {
  user: User | null;
  ready: boolean;
  isAdmin: boolean;
  isSuper: boolean;
  can: (p: Perm) => boolean;
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({} as Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (token) {
        try {
          setUser(await api<User>("/auth/me"));
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, [logout]);

  const login = async (userId: string, pin: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { user_id: userId, pin },
    });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
  };

  const isSuper = user?.role === "super_admin";
  const isAdmin = isSuper || user?.role === "admin";
  const can = (p: Perm) => isSuper || !!user?.permissions?.[p];
  return <AuthCtx.Provider value={{ user, ready, isAdmin, isSuper, can, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
