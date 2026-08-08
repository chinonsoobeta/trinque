import { coarseLocation, normalizeLocation, type NormalizedLocation } from "./location.ts";
import type { MeasurementSystem, ThemePreference } from "./regions.ts";
import { resolveUiLanguage, UI_LANGUAGES, type UiLanguage } from "../ios/i18n.ts";

export type Preferences = {
  language: UiLanguage;
  theme: ThemePreference;
  measurementSystem: MeasurementSystem;
  location: NormalizedLocation | null;
};

export type PreferencesSnapshot = Preferences & { ready: boolean };

const KEYS = { language: "trinque.language", theme: "trinque.theme", measurement: "trinque.measurement", location: "trinque.location" } as const;

/**
 * What the server renders, and what a browser without stored choices starts
 * from. It must be a stable object: `useSyncExternalStore` compares snapshots by
 * identity and would otherwise loop.
 */
const SERVER: PreferencesSnapshot = { language: "en-CA", theme: "system", measurementSystem: "metric", location: null, ready: false };

/**
 * One store for language, theme, units and area.
 *
 * These were kept in two places at once: React state inside the provider, and
 * `localStorage` read directly by `useUiLanguage`, kept roughly in step by a
 * `trinque:language` DOM event. The two could disagree — the deferred restore
 * from storage could also land *after* the server's answer and quietly overwrite
 * it — so there is now a single value that both the provider and the translator
 * subscribe to.
 */
let snapshot: PreferencesSnapshot = SERVER;
let hydrated = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function readStored(): PreferencesSnapshot {
  const storedLanguage = window.localStorage.getItem(KEYS.language) as UiLanguage | null;
  const language = storedLanguage && UI_LANGUAGES.includes(storedLanguage) ? storedLanguage : resolveUiLanguage(navigator.languages);
  const storedTheme = window.localStorage.getItem(KEYS.theme);
  const theme: ThemePreference = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
  const storedMeasurement = window.localStorage.getItem(KEYS.measurement);
  const measurementSystem: MeasurementSystem = storedMeasurement === "imperial" ? "imperial" : "metric";
  let location: NormalizedLocation | null = null;
  const storedLocation = window.localStorage.getItem(KEYS.location);
  if (storedLocation) {
    try { location = normalizeLocation(JSON.parse(storedLocation) as NormalizedLocation, language); }
    catch { window.localStorage.removeItem(KEYS.location); }
  }
  return { language, theme, measurementSystem, location, ready: true };
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // A second tab is a legitimate way for these to change, and the store is the
  // only thing that needs to know about it now.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !Object.values(KEYS).includes(event.key as (typeof KEYS)[keyof typeof KEYS])) return;
    snapshot = readStored();
    announce();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/**
 * Reads storage on the first client call rather than on a timer. React uses the
 * server snapshot through hydration and only then switches to this one, so
 * reading synchronously here cannot mismatch the server's markup.
 */
export function getSnapshot(): PreferencesSnapshot {
  if (!hydrated) { hydrated = true; snapshot = readStored(); }
  return snapshot;
}

export function getServerSnapshot(): PreferencesSnapshot {
  return SERVER;
}

/** Applies a change and caches it locally. The network write lives in the provider. */
export function applyPreferences(next: Partial<Preferences>): PreferencesSnapshot {
  const current = getSnapshot();
  const language = next.language ?? current.language;
  const measurementSystem = next.measurementSystem ?? current.measurementSystem;
  const chosen = next.location === undefined ? current.location : next.location;
  const location = chosen ? { ...chosen, language, measurementSystem } : null;
  snapshot = { language, theme: next.theme ?? current.theme, measurementSystem, location, ready: true };

  window.localStorage.setItem(KEYS.language, snapshot.language);
  window.localStorage.setItem(KEYS.theme, snapshot.theme);
  window.localStorage.setItem(KEYS.measurement, snapshot.measurementSystem);
  // Only a coarse area is ever written down — the precise one stays in memory.
  if (location) window.localStorage.setItem(KEYS.location, JSON.stringify(coarseLocation(location)));
  else window.localStorage.removeItem(KEYS.location);

  announce();
  return snapshot;
}

/** Test seam: the store is module state, and tests need to start from nothing. */
export function resetPreferencesForTest() {
  snapshot = SERVER; hydrated = false; listeners.clear();
}
