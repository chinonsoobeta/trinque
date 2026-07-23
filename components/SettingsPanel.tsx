"use client";

import { FormEvent, useEffect, useState } from "react";
import { coarseLocation, normalizeLocation, type NormalizedLocation } from "@/lib/location";
import type { LocationSuggestion } from "@/lib/places/types";
import { REGIONAL_DEFAULTS, type MeasurementSystem, type ThemePreference } from "@/lib/regions";
import { LANGUAGE_LABEL_KEYS, translate, UI_LANGUAGES, type MessageKey, type UiLanguage } from "@/ios/i18n";
import { AuthControls } from "@/components/AuthControls";
import { PrivacySettings } from "@/components/PrivacySettings";

type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

export function SettingsPanel({ guestToken, t, language, theme, measurementSystem, location, close, persist }: { guestToken: string | null; t: Translator; language: UiLanguage; theme: ThemePreference; measurementSystem: MeasurementSystem; location: NormalizedLocation | null; close: () => void; persist: (next: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: NormalizedLocation | null }) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setBusy(true); setStatus(""); setSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json", ...(guestToken ? { Authorization: `Guest ${guestToken}` } : {}) }, body: JSON.stringify({ ...payload, language, location }) });
      const body = await response.json() as { suggestions?: LocationSuggestion[]; location?: NormalizedLocation; error?: { code?: string } };
      if (!response.ok) {
        setStatus(body.error?.code === "unsupported_country" ? t("location.unsupported") : body.error?.code === "credentials" ? t("location.unavailable") : t("location.providerError"));
        return;
      }
      if (body.location) {
        const defaults = REGIONAL_DEFAULTS[body.location.countryCode];
        const selected = { ...body.location, language, measurementSystem: defaults.measurementSystem };
        await persist({ location: selected, measurementSystem: defaults.measurementSystem });
        setStatus(t("location.current", { location: `${selected.locality}, ${selected.countryCode}` }));
        return;
      }
      setSuggestions(body.suggestions ?? []);
    } catch { setStatus(t("location.unavailable")); }
    finally { setBusy(false); }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setStatus(t("location.permissionDenied")); return; }
    setBusy(true); setStatus("");
    navigator.geolocation.getCurrentPosition(
      (position) => void search({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => { setBusy(false); setStatus(t("location.permissionDenied")); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60 * 1000 },
    );
  }

  async function selectSuggestion(suggestion: LocationSuggestion) {
    await search({ providerPlaceId: suggestion.providerPlaceId });
  }

  return <div className="settings-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="settings-panel">
    <div className="settings-heading"><h2 id="settings-title">{t("settings.title")}</h2><button onClick={close} aria-label={t("settings.close")}>×</button></div>
    <div className="setting-block"><span>{t("settings.language")}</span><select value={language} className="setting-select" onChange={(event) => void persist({ language: event.target.value as UiLanguage })}>{UI_LANGUAGES.map((item) => <option key={item} value={item}>{t(LANGUAGE_LABEL_KEYS[item])}</option>)}</select></div>
    <div className="setting-block"><span>{t("settings.theme")}</span><div className="setting-options">{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} onClick={() => void persist({ theme: item })}>{t(`settings.theme.${item}`)}</button>)}</div></div>
    <div className="setting-block"><span>{t("settings.measurement")}</span><div className="setting-options">{(["metric", "imperial"] as const).map((item) => <button key={item} className={measurementSystem === item ? "active" : ""} onClick={() => void persist({ measurementSystem: item })}>{t(item === "metric" ? "location.metric" : "location.imperial")}</button>)}</div></div>
    <div className="setting-block"><span>{t("settings.location")}</span>{location && <p className="location-status">{t("location.current", { location: `${location.locality}, ${location.countryCode}` })}</p>}<button className="location-chip" disabled={busy} onClick={useDeviceLocation}>{t("location.useDevice")}</button><form className="location-search" onSubmit={(event: FormEvent) => { event.preventDefault(); if (query.trim()) void search({ input: query.trim() }); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("location.search")} /><button disabled={busy || !query.trim()}>{t("location.searchAction")}</button></form>{status && <p className="location-status warning">{status}</p>}<div className="location-suggestions">{suggestions.map((suggestion) => <button key={suggestion.id} onClick={() => void selectSuggestion(suggestion)}><b>{suggestion.label}</b><br /><small>{suggestion.secondaryLabel}</small></button>)}{suggestions.length > 0 && <small className="google-attribution" translate="no">Google Maps</small>}</div><p className="privacy-note">{t("location.privacy")}</p></div>
    <AuthControls />
    <PrivacySettings />
  </aside></div>;
}
