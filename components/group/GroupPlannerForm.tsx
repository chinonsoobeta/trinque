"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { usePreferences } from "@/components/PreferencesProvider";
import { useToast } from "@/components/ToastProvider";
import { useAnalytics } from "@/components/useAnalytics";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import { DIETARY_OPTIONS, type GroupSnapshot } from "@/components/group/types";
import type { NormalizedLocation } from "@/lib/location";
import type { LocationSuggestion } from "@/lib/places/types";
import { isSupportedCountry } from "@/lib/regions";
import type { MessageKey } from "@/ios/i18n";

/**
 * Everything the ranker needs before it can shortlist anywhere: when, where,
 * how far, how much, and what nobody at the table can eat.
 *
 * `from` prefills the form with an existing plan so "change plan" is an edit
 * rather than a retype.
 */
export function GroupPlannerForm({ from }: { from?: GroupSnapshot | null }) {
  const router = useRouter();
  const { authenticated, authHeaders, sessionToken } = useAuth();
  const { location: savedLocation } = usePreferences();
  const { flash } = useToast();
  const track = useAnalytics();
  const t = useUiText();
  const language = useUiLanguage();

  // `from` is resolved before this form mounts, so the plan being edited is the
  // form's initial state rather than something an effect writes in afterwards.
  const prefilledLocation = from?.locality && isSupportedCountry(from.countryCode) && typeof from.latitude === "number" && typeof from.longitude === "number"
    ? { latitude: from.latitude, longitude: from.longitude, locality: from.locality, countryCode: from.countryCode, administrativeRegion: from.administrativeRegion ?? "", language, measurementSystem: "metric" as const, timeZone: from.timeZone ?? "", locale: from.locale ?? language, currencyCode: from.currencyCode ?? "", source: "manual" as const }
    : null;

  const [busy, setBusy] = useState(false);
  const [budgetMax, setBudgetMax] = useState(from ? String(from.budgetMax) : "");
  const [maxDistanceKm, setMaxDistanceKm] = useState(from ? String(from.distanceUnit === "imperial" ? Math.round(from.maxDistanceKm * 0.621371 * 10) / 10 : from.maxDistanceKm) : "");
  const [distanceUnit, setDistanceUnit] = useState<"metric" | "imperial">(from?.distanceUnit ?? "metric");
  const [allergies, setAllergies] = useState(from?.allergies.join(", ") ?? "");
  const [dietaryRequirements, setDietaryRequirements] = useState<string[]>(from?.dietaryRequirements ?? []);
  const [cuisineTypes, setCuisineTypes] = useState(from?.cuisineTypes.join(", ") ?? "");
  const [eventLocalDate, setEventLocalDate] = useState(from?.eventLocalDate ?? "");
  const [eventLocalTime, setEventLocalTime] = useState(from?.eventLocalTime ?? "");
  const [groupLocation, setGroupLocation] = useState<NormalizedLocation | null>(prefilledLocation);
  const [locationQuery, setLocationQuery] = useState(prefilledLocation ? `${prefilledLocation.locality}, ${prefilledLocation.countryCode}` : "");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  async function searchLocation(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setLocationBusy(true); setLocationStatus(""); setLocationSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ ...payload, language, location: groupLocation ?? null }) });
      const body = await response.json() as { suggestions?: LocationSuggestion[]; location?: NormalizedLocation; error?: { code?: string } };
      if (!response.ok) {
        setLocationStatus(body.error?.code === "unsupported_country" ? t("location.unsupported") : body.error?.code === "credentials" ? t("location.unavailable") : t("location.providerError"));
        return;
      }
      if (body.location) {
        const selected = { ...body.location, language, measurementSystem: body.location.measurementSystem ?? "metric" };
        setGroupLocation(selected); setLocationSuggestions([]); setLocationQuery(`${selected.locality}, ${selected.countryCode}`);
        return;
      }
      setLocationSuggestions(body.suggestions ?? []);
    } catch { setLocationStatus(t("location.unavailable")); }
    finally { setLocationBusy(false); }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setLocationStatus(t("location.permissionDenied")); return; }
    setLocationBusy(true); setLocationStatus("");
    navigator.geolocation.getCurrentPosition(
      (position) => void searchLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => { setLocationBusy(false); setLocationStatus(t("location.permissionDenied")); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60 * 1000 },
    );
  }

  function useSavedArea() {
    if (groupLocation) { setGroupLocation(null); setLocationQuery(""); return; }
    if (savedLocation) { setGroupLocation(savedLocation); setLocationQuery(`${savedLocation.locality}, ${savedLocation.countryCode}`); return; }
    setLocationSuggestions([]);
  }

  async function createGroup() {
    if (!authenticated) { window.location.assign("/auth/login?context=group&next=%2Fgroups"); return; }
    if (!sessionToken) { flash(t("auth.connecting")); return; }
    if (!groupLocation) { setLocationStatus(t("location.choose")); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: t("group.name"), eventLocalDate: eventLocalDate || undefined, eventLocalTime: eventLocalTime || undefined, location: groupLocation, language, budgetMax: Number(budgetMax) || undefined, maxDistance: Number(maxDistanceKm) || undefined, distanceUnit, allergies: allergies.split(","), dietaryRequirements, cuisineTypes: cuisineTypes.split(",") }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { code?: string } | null;
        if (failure?.code === "profile_incomplete") { router.push("/onboarding"); return; }
        throw new Error();
      }
      const payload = await response.json() as { group: GroupSnapshot };
      track("group_created", { outcome: "success" });
      flash(t("group.rank"));
      router.push(`/groups/${payload.group.id}`);
    } catch { flash(t("error.generic")); }
    finally { setBusy(false); }
  }

  const incomplete = authenticated && (!sessionToken || !groupLocation || !eventLocalDate || !eventLocalTime);
  return <section className="group-page">
    <div className="group-intro">
      <div className="eyebrow"><Icon name="groups" size={16} /> {t("group.eyebrow")}</div>
      <h1>{t("group.createTitle")}</h1>
      <p>{t("group.createBody")}</p>
    </div>
    <div className="group-starter">
      <span className="kicker">{t("group.start")}</span>
      <h2>{t("group.name")}</h2>
      <div className="group-location-row">
        <div><span>{t("settings.location")}</span><b>{groupLocation ? t("location.current", { location: `${groupLocation.locality}, ${groupLocation.countryCode}` }) : t("location.choose")}</b></div>
        <button className="group-location-button" type="button" onClick={useDeviceLocation}><Icon name="location" size={16} />{t("location.useDevice")}</button>
      </div>
      <div className="group-location-search">
        <form className="location-search" onSubmit={(event: FormEvent) => { event.preventDefault(); if (locationQuery.trim()) void searchLocation({ input: locationQuery.trim() }); }}>
          <input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={t("location.search")} aria-label={t("location.search")} />
          <button disabled={locationBusy || !locationQuery.trim()}>{t("location.searchAction")}</button>
        </form>
        <button className="text-button" type="button" onClick={useSavedArea}>{groupLocation ? t("location.clear") : t("location.useSaved")}</button>
        {locationBusy && <p className="location-status">{t("location.searching")}</p>}
        {locationStatus && <p className="location-status warning" role="alert">{locationStatus}</p>}
        <div className="location-suggestions">
          {locationSuggestions.map((suggestion) => <button key={suggestion.id} onClick={() => void searchLocation({ providerPlaceId: suggestion.providerPlaceId })}><b>{suggestion.label}</b><br /><small>{suggestion.secondaryLabel}</small></button>)}
          {locationSuggestions.length > 0 && <small className="google-attribution" translate="no">Google Maps</small>}
        </div>
      </div>
      <div className="planner-form">
        <label>{t("group.date")}<input type="date" value={eventLocalDate} onChange={(event) => setEventLocalDate(event.target.value)} /></label>
        <label>{t("group.time")}<input type="time" value={eventLocalTime} onChange={(event) => setEventLocalTime(event.target.value)} /></label>
        <label>{t("group.budget")}<input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} inputMode="numeric" placeholder={t("group.budgetPlaceholder")} /></label>
        <label>{t("group.radius")}<div className="distance-input"><input value={maxDistanceKm} onChange={(event) => setMaxDistanceKm(event.target.value)} inputMode="numeric" placeholder={t("group.radiusPlaceholder")} /><select aria-label={t("group.distanceUnit")} value={distanceUnit} onChange={(event) => setDistanceUnit(event.target.value as "metric" | "imperial")}><option value="metric">{t("location.metric")}</option><option value="imperial">{t("location.imperial")}</option></select></div></label>
        <fieldset>
          <legend>{t("group.dietary")}</legend>
          {DIETARY_OPTIONS.map((item) => <label key={item}><input type="checkbox" checked={dietaryRequirements.includes(item)} onChange={(event) => setDietaryRequirements((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{t(`diet.${item.replace("_", "-")}` as MessageKey)}</label>)}
        </fieldset>
        <label>{t("group.allergies")}<input value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder={t("group.allergyExample")} /></label>
        <label>{t("group.cuisines")}<input value={cuisineTypes} onChange={(event) => setCuisineTypes(event.target.value)} placeholder={t("group.cuisineExample")} /></label>
      </div>
      {/* A hint, not a warning: this shows on arrival, before anyone has had
          the chance to do anything wrong, and the amber read as a reprimand. */}
      {!groupLocation && <p className="location-status">{t("location.choose")}</p>}
      <button className="primary full" disabled={busy || incomplete} onClick={() => void createGroup()}>{busy ? t("group.building") : authenticated ? t("group.rank") : t("auth.signIn")}</button>
    </div>
  </section>;
}
