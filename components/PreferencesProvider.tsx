"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { applyPreferences, getServerSnapshot, getSnapshot, subscribe, type Preferences } from "@/lib/preferences-store";

export type { Preferences };

type PreferencesContextValue = Preferences & {
  ready: boolean;
  persist: (next: Partial<Preferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Language, theme, units and area, in one place.
 *
 * These used to live in the root page component, which meant every screen that
 * needed them had to be part of that component. The values themselves now live
 * in `lib/preferences-store`, which the translator also reads — this component
 * owns only the network half: read `/api/preferences` so a second device agrees,
 * and write back when something changes.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken } = useAuth();
  const { language, theme, measurementSystem, location, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Nothing is stored server-side for a visitor who has not signed in, and the
    // write path below already skips them — asking anyway only produced a 401 in
    // the console on every first visit.
    if (!sessionToken) return;
    let active = true;
    void fetch("/api/preferences", { headers: { Authorization: `Session ${sessionToken}` } })
      .then(async (response) => response.ok ? await response.json() as { preferences: Partial<Preferences> | null } : null)
      .then((payload) => { if (active && payload?.preferences) applyPreferences(payload.preferences); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sessionToken]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.themePreference = theme;
      document.documentElement.lang = language;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [language, theme]);

  const persist = useCallback(async (next: Partial<Preferences>) => {
    const applied = applyPreferences(next);
    if (!sessionToken) return;
    const headers = { Authorization: `Session ${sessionToken}`, "Content-Type": "application/json" };
    await fetch("/api/preferences", { method: "PUT", headers, body: JSON.stringify({ language: applied.language, theme: applied.theme, measurementSystem: applied.measurementSystem, location: applied.location }) }).catch(() => undefined);
    // Storing an area is a consent decision, not only a preference.
    if (next.location !== undefined) await fetch("/api/privacy", { method: "PUT", headers, body: JSON.stringify({ locationConsent: Boolean(applied.location) }) }).catch(() => undefined);
  }, [sessionToken]);

  const value = useMemo<PreferencesContextValue>(
    () => ({ language, theme, measurementSystem, location, ready, persist }),
    [language, location, measurementSystem, persist, ready, theme],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return value;
}
