"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { clearToken, getToken, setActiveBranchId, setToken, getActiveBranchId } from "./api";

export interface AuthBranch {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branches: AuthBranch[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  activeBranchId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchBranch: (branchId: string) => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranch] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<AuthUser>("/auth/me");
        setUser(me);
        const stored = getActiveBranchId();
        const branchId = stored ?? me.branches.find((b) => b.isDefault)?.id ?? me.branches[0]?.id ?? null;
        if (branchId) {
          setActiveBranchId(branchId);
          setActiveBranch(branchId);
        }
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
    setToken(res.token);
    setUser(res.user);
    const branchId = res.user.branches.find((b) => b.isDefault)?.id ?? res.user.branches[0]?.id ?? null;
    if (branchId) {
      setActiveBranchId(branchId);
      setActiveBranch(branchId);
    }
    router.push("/dashboard");
  }

  function logout() {
    clearToken();
    setUser(null);
    setActiveBranch(null);
    router.push("/login");
  }

  function switchBranch(branchId: string) {
    setActiveBranchId(branchId);
    setActiveBranch(branchId);
    router.refresh();
  }

  function can(permission: string) {
    if (!user) return false;
    return user.permissions.includes("*") || user.permissions.includes(permission);
  }

  return (
    <AuthContext.Provider value={{ user, loading, activeBranchId, login, logout, switchBranch, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
