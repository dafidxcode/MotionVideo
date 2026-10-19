"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SwdbotSessionUser } from "./auth";

interface AuthContextType {
  user: SwdbotSessionUser | null;
  isLoading: boolean;
  login: (
    credential: string,
    turnstileToken?: string,
  ) => Promise<{ success: boolean; error?: string; status?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SwdbotSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      // BUG-02: no `x-user-api-key` header and no key in localStorage.
      // The httpOnly session cookie is the only credential.
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          // BUG-50: Strip key before persisting to localStorage (prevent credential leakage to localStorage)
          const { key: _key, ...safeUser } = data.user;
          localStorage.setItem("swdbot_user_info", JSON.stringify(safeUser));
          return;
        }
      }

      // If unauthorized on protected route, clear and redirect
      if (res.status === 401 || res.status === 403) {
        setUser(null);
        localStorage.removeItem("swdbot_user_api_key");
        localStorage.removeItem("swdbot_user_info");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          router.push("/login");
        }
      }
    } catch (err) {
      console.warn("[Auth] Failed to refresh user profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Initial load: check localStorage for instant response
    try {
      const cached = localStorage.getItem("swdbot_user_info");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      }
    } catch { }

    refreshUser();
  }, [refreshUser]);

  // Listen for instant credit/quota sync events across the app
  useEffect(() => {
    const handleRefresh = () => {
      refreshUser();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("swdbot-refresh-user", handleRefresh);
      return () => {
        window.removeEventListener("swdbot-refresh-user", handleRefresh);
      };
    }
  }, [refreshUser]);

  // Periodic quota & VIP refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshUser();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const login = useCallback(
    async (
      credential: string,
      turnstileToken?: string,
    ): Promise<{ success: boolean; error?: string; status?: string }> => {
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, turnstileToken }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setUser(data.user);
          // BUG-02 & BUG-50: the legacy API key is never persisted to localStorage.
          localStorage.removeItem("swdbot_user_api_key");
          const { key: _key, ...safeUser } = data.user;
          localStorage.setItem("swdbot_user_info", JSON.stringify(safeUser));
          return { success: true };
        }

        return {
          success: false,
          error: data.error || "Login failed. Please try again.",
          status: data.status,
        };
      } catch (err: any) {
        return {
          success: false,
          error: "Failed to connect to authentication server.",
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    setUser(null);
    localStorage.removeItem("swdbot_user_api_key");
    localStorage.removeItem("swdbot_user_info");
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
