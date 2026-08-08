"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { coarseLocation, normalizeLocation, type NormalizedLocation } from "@/lib/location";
import type { MeasurementSystem, ThemePreference } from "@/lib/regions";
import { resolveUiLanguage, UI_LANGUAGES, type UiLanguage } from "@/ios/i18n";

export type Preferences = {
  language: UiLanguage;
  theme: ThemePreference;
  measurementSystem: MeasurementSystem;
  location: NormalizedLocation | null;
};

type PreferencesContextValue = Preferences & {
  ready: boolean;
  persist: (next: Partial<Preferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Language, theme, units and area, in one place.
 *
 * These used to live in the root page component, which meant every screen that
 * needed them had to be part of that component. Reading order is
 * localStorage first (so the first paint is right) then `/api/preferences`
 * (so a second device agrees), and writes go to both.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken } = useAuth();
  const [language, setLanguage] = useState<UiLanguage>("en-CA");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [location, setLocation] = useState<NormalizedLocation | null>(null);
  const [ready, setReady] = useState(false);

  // Deferred by a tick: the server rendered the defaults, so reading storage
  // during the effect body itself would change state mid-hydration.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLanguage = window.localStorage.getItem("trinque.language") as UiLanguage | null;
      const storedTheme = window.localStorage.getItem("trinque.theme");
      const storedMeasurement = window.localStorage.getItem("trinque.measurement");
      const storedLocation = window.localStorage.getItem("trinque.location");
      const restoredLanguage = storedLanguage && UI_LANGUAGES.includes(storedLanguage) ? storedLanguage : resolveUiLanguage(navigator.languages);
      setLanguage(restoredLanguage);
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") setTheme(storedTheme);
      if (storedMeasurement === "metric" || storedMeasurement === "imperial") setMeasurementSystem(storedMeasurement);
      if (storedLocation) {
        try { setLocation(normalizeLocation(JSON.parse(storedLocation) as NormalizedLocation, restoredLanguage)); }
        catch { window.localStorage.removeItem("trinque.location"); }
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/preferences", { headers: sessionToken ? { Authorization: `Session ${sessionToken}` } : undefined })
      .then(async (response) => response.ok ? await response.json() as { preferences: Partial<Preferences> | null } : null)
      .then((payload) => {
        if (!active || !payload?.preferences) return;
        const stored = payload.preferences;
        if (stored.language) { setLanguage(stored.language); window.localStorage.setItem("trinque.language", stored.language); window.dispatchEvent(new Event("trinque:language")); }
        if (stored.theme) setTheme(stored.theme);
        if (stored.measurementSystem) setMeasurementSystem(stored.measurementSystem);
        if (stored.location) setLocation(stored.location);
      })
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
    const nextLanguage = next.language ?? language;
    const nextTheme = next.theme ?? theme;
    const nextMeasurement = next.measurementSystem ?? measurementSystem;
    const chosenLocation = next.location === undefined ? location : next.location;
    const nextLocation = chosenLocation ? { ...chosenLocation, language: nextLanguage, measurementSystem: nextMeasurement } : null;

    setLanguage(nextLanguage); setTheme(nextTheme); setMeasurementSystem(nextMeasurement); setLocation(nextLocation);
    window.localStorage.setItem("trinque.language", nextLanguage);
    window.dispatchEvent(new Event("trinque:language"));
    window.localStorage.setItem("trinque.theme", nextTheme);
    window.localStorage.setItem("trinque.measurement", nextMeasurement);
    if (nextLocation) window.localStorage.setItem("trinque.location", JSON.stringify(coarseLocation(nextLocation)));
    else window.localStorage.removeItem("trinque.location");

    if (!sessionToken) return;
    const headers = { Authorization: `Session ${sessionToken}`, "Content-Type": "application/json" };
    await fetch("/api/preferences", { method: "PUT", headers, body: JSON.stringify({ language: nextLanguage, theme: nextTheme, measurementSystem: nextMeasurement, location: nextLocation }) }).catch(() => undefined);
    // Storing an area is a consent decision, not only a preference.
    if (next.location !== undefined) await fetch("/api/privacy", { method: "PUT", headers, body: JSON.stringify({ locationConsent: Boolean(nextLocation) }) }).catch(() => undefined);
  }, [language, location, measurementSystem, sessionToken, theme]);

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
