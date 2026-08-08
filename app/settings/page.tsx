"use client";

import { useState, type FormEvent } from "react";
import { PageContainer } from "@/components/AppPrimitives";
import { AuthControls } from "@/components/AuthControls";
import { Icon } from "@/components/Icon";
import { PrivacySettings } from "@/components/PrivacySettings";
import { SafetyCenter } from "@/components/SafetyCenter";
import { usePreferences } from "@/components/PreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";
import type { NormalizedLocation } from "@/lib/location";
import type { LocationSuggestion } from "@/lib/places/types";
import { REGIONAL_DEFAULTS } from "@/lib/regions";
import { LANGUAGE_LABEL_KEYS, UI_LANGUAGES, type UiLanguage } from "@/ios/i18n";

/**
 * The one settings home. Language, theme, units, area, privacy and safety used
 * to be split between `/account` and a modal that only opened from `/`.
 */
export default function SettingsPage() {
  const { authHeaders } = useAuth();
  const { language, theme, measurementSystem, location, persist } = usePreferences();
  const t = useUiText();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setBusy(true); setStatus(""); setSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ ...payload, language, location }) });
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

  return <PageContainer className="settings-page">
    <header className="page-hero compact"><span className="kicker"><Icon name="settings" size={14} /></span><h1>{t("settings.title")}</h1></header>

    <section className="setting-block">
      <span>{t("settings.language")}</span>
      <select className="setting-select" aria-label={t("settings.language")} value={language} onChange={(event) => void persist({ language: event.target.value as UiLanguage })}>
        {UI_LANGUAGES.map((item) => <option key={item} value={item}>{t(LANGUAGE_LABEL_KEYS[item])}</option>)}
      </select>
    </section>

    <section className="setting-block">
      <span>{t("settings.theme")}</span>
      <div className="setting-options">{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} aria-pressed={theme === item} onClick={() => void persist({ theme: item })}>{t(`settings.theme.${item}`)}</button>)}</div>
    </section>

    <section className="setting-block">
      <span>{t("settings.measurement")}</span>
      <div className="setting-options">{(["metric", "imperial"] as const).map((item) => <button key={item} className={measurementSystem === item ? "active" : ""} aria-pressed={measurementSystem === item} onClick={() => void persist({ measurementSystem: item })}>{t(item === "metric" ? "location.metric" : "location.imperial")}</button>)}</div>
    </section>

    <section className="setting-block">
      <span>{t("settings.location")}</span>
      {location && <p className="location-status">{t("location.current", { location: `${location.locality}, ${location.countryCode}` })}</p>}
      <button className="location-chip" disabled={busy} onClick={useDeviceLocation}><Icon name="location" size={16} />{t("location.useDevice")}</button>
      <form className="location-search" onSubmit={(event: FormEvent) => { event.preventDefault(); if (query.trim()) void search({ input: query.trim() }); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("location.search")} aria-label={t("location.search")} />
        <button disabled={busy || !query.trim()}>{t("location.searchAction")}</button>
      </form>
      {status && <p className="location-status warning" role="status">{status}</p>}
      <div className="location-suggestions">
        {suggestions.map((suggestion) => <button key={suggestion.id} onClick={() => void search({ providerPlaceId: suggestion.providerPlaceId })}><b>{suggestion.label}</b><br /><small>{suggestion.secondaryLabel}</small></button>)}
        {suggestions.length > 0 && <small className="google-attribution" translate="no">Google Maps</small>}
      </div>
      {location && <button className="text-button" onClick={() => void persist({ location: null })}>{t("location.clear")}</button>}
      <p className="privacy-note">{t("location.privacy")}</p>
    </section>

    <AuthControls />
    <PrivacySettings />
    <SafetyCenter />
  </PageContainer>;
}
