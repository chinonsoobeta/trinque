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
  // Setting an area successfully and failing to reach the provider used to
  // share one string painted in the warning amber, so "Current area: Vancouver,
  // CA" arrived looking like something had gone wrong.
  const [status, setStatus] = useState<{ text: string; problem: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setBusy(true); setStatus(null); setSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ ...payload, language, location }) });
      const body = await response.json() as { suggestions?: LocationSuggestion[]; location?: NormalizedLocation; error?: { code?: string } };
      if (!response.ok) {
        setStatus({ text: body.error?.code === "unsupported_country" ? t("location.unsupported") : body.error?.code === "credentials" ? t("location.unavailable") : t("location.providerError"), problem: true });
        return;
      }
      if (body.location) {
        const defaults = REGIONAL_DEFAULTS[body.location.countryCode];
        const selected = { ...body.location, language, measurementSystem: defaults.measurementSystem };
        await persist({ location: selected, measurementSystem: defaults.measurementSystem });
        setStatus({ text: t("location.current", { location: `${selected.locality}, ${selected.countryCode}` }), problem: false });
        return;
      }
      setSuggestions(body.suggestions ?? []);
    } catch { setStatus({ text: t("location.unavailable"), problem: true }); }
    finally { setBusy(false); }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setStatus({ text: t("location.permissionDenied"), problem: true }); return; }
    setBusy(true); setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => void search({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => { setBusy(false); setStatus({ text: t("location.permissionDenied"), problem: true }); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60 * 1000 },
    );
  }

  return <PageContainer className="settings-page">
    <header className="page-hero compact"><span className="kicker"><Icon name="settings" size={14} /></span><h1>{t("settings.title")}</h1></header>

    <section className="setting-block">
      <h2>{t("settings.language")}</h2>
      <select className="setting-select" aria-label={t("settings.language")} value={language} onChange={(event) => void persist({ language: event.target.value as UiLanguage })}>
        {UI_LANGUAGES.map((item) => <option key={item} value={item}>{t(LANGUAGE_LABEL_KEYS[item])}</option>)}
      </select>
    </section>

    <section className="setting-block">
      <h2>{t("settings.theme")}</h2>
      <div className="setting-options">{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} aria-pressed={theme === item} onClick={() => void persist({ theme: item })}>{t(`settings.theme.${item}`)}</button>)}</div>
    </section>

    <section className="setting-block">
      <h2>{t("settings.measurement")}</h2>
      <div className="setting-options">{(["metric", "imperial"] as const).map((item) => <button key={item} className={measurementSystem === item ? "active" : ""} aria-pressed={measurementSystem === item} onClick={() => void persist({ measurementSystem: item })}>{t(item === "metric" ? "location.metric" : "location.imperial")}</button>)}</div>
    </section>

    <section className="setting-block">
      <h2>{t("settings.location")}</h2>
      {location && <p className="location-status">{t("location.current", { location: `${location.locality}, ${location.countryCode}` })}</p>}
      <button className="location-chip" disabled={busy} onClick={useDeviceLocation}><Icon name="location" size={16} />{t("location.useDevice")}</button>
      <form className="location-search" onSubmit={(event: FormEvent) => { event.preventDefault(); if (query.trim()) void search({ input: query.trim() }); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("location.search")} aria-label={t("location.search")} />
        <button disabled={busy || !query.trim()}>{t("location.searchAction")}</button>
      </form>
      {status && <p className={status.problem ? "location-status warning" : "location-status"} role={status.problem ? "alert" : "status"}>{status.text}</p>}
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
