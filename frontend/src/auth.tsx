import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, TOKEN_KEY, User } from "@/src/api";
import { registerForPush } from "@/src/push";
import { storage } from "@/src/utils/storage";

type RegisterData = { name: string; email: string; password: string; city: string; state: string; whatsapp: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (d: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet(TOKEN_KEY, "");
      if (token) {
        try {
          const me = await apiFetch<User>("/auth/me");
          setUser(me);
          registerForPush(me.id);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const finish = useCallback(async (r: { token: string; user: User }) => {
    await storage.secureSet(TOKEN_KEY, r.token);
    setUser(r.user);
    registerForPush(r.user.id);
    return r.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      finish(await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
    [finish],
  );

  const register = useCallback(
    async (d: RegisterData) => finish(await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(d) })),
    [finish],
  );

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
