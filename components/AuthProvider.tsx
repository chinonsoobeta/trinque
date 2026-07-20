"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, signOutSupabase } from "@/lib/auth-client";

type Identity = {
  id: string;
  authType: "guest" | "chatgpt" | "supabase";
  displayName: string;
  email: string | null;
};

type AuthContextValue = {
  user: User | null;
  identity: Identity | null;
  loading: boolean;
  authenticated: boolean;
  sessionToken: string | null;
  authHeaders: () => Record<string, string>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = "trinque.sessionToken";
const LEGACY_KEY = "trinque.guestToken";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const establishAppSession = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error("Unable to establish Trinque session.");
    const payload = await response.json() as { identity: Identity; sessionToken: string };
    window.localStorage.setItem(SESSION_KEY, payload.sessionToken);
    // Transitional alias: existing web/iOS callers still send `Guest <token>`.
    window.localStorage.setItem(LEGACY_KEY, payload.sessionToken);
    setSessionToken(payload.sessionToken);
    setIdentity(payload.identity);
  }, []);

  const restoreAppSession = useCallback(async (): Promise<boolean> => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setSessionToken(null);
      setIdentity(null);
      return false;
    }
    const response = await fetch("/api/auth/session", { headers: { Authorization: `Session ${stored}` }, cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json() as { authenticated: boolean; identity: Identity | null };
    if (!payload.authenticated || !payload.identity) {
      window.localStorage.removeItem(SESSION_KEY);
      setSessionToken(null);
      setIdentity(null);
      return false;
    }
    setSessionToken(stored);
    setIdentity(payload.identity);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    await restoreAppSession();
  }, [restoreAppSession]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const client = await getSupabaseClient();
      if (!active) return;
      if (!client) {
        await restoreAppSession();
        if (active) setLoading(false);
        return;
      }
      const { data: { session } } = await client.auth.getSession();
      if (!active) return;
      setUser(session?.user ?? null);
      try {
        const restored = await restoreAppSession();
        if (!restored && session?.access_token) await establishAppSession(session.access_token);
      } finally {
        if (active) setLoading(false);
      }
      const { data } = client.auth.onAuthStateChange((event, nextSession) => {
        setUser(nextSession?.user ?? null);
        if (event === "SIGNED_OUT") {
          window.localStorage.removeItem(SESSION_KEY);
          window.localStorage.removeItem(LEGACY_KEY);
          setSessionToken(null);
          setIdentity(null);
          return;
        }
        if (event === "SIGNED_IN" && nextSession?.access_token && window.location.pathname !== "/auth/callback") {
          void establishAppSession(nextSession.access_token).catch(() => undefined);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();
    return () => { active = false; unsubscribe?.(); };
  }, [establishAppSession, restoreAppSession]);

  const signOut = useCallback(async () => {
    const token = window.localStorage.getItem(SESSION_KEY);
    if (token) await fetch("/api/auth/session", { method: "DELETE", headers: { Authorization: `Session ${token}` } }).catch(() => undefined);
    await signOutSupabase();
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    setSessionToken(null);
    setIdentity(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    identity,
    loading,
    authenticated: Boolean(identity && identity.authType !== "guest"),
    sessionToken,
    authHeaders: (): Record<string, string> => sessionToken ? { Authorization: `Session ${sessionToken}` } : {},
    refresh,
    signOut,
  }), [identity, loading, refresh, sessionToken, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
