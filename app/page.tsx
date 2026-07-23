"use client";

import Image from "next/image";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coarseLocation, normalizeLocation, type NormalizedLocation } from "@/lib/location";
import type { RestaurantPlace } from "@/lib/places/types";
import { type MeasurementSystem, type ThemePreference } from "@/lib/regions";
import { resolveUiLanguage, translate, UI_LANGUAGES, type MessageKey, type UiLanguage } from "@/ios/i18n";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";
import { FeedCard, type FeedDish } from "@/components/FeedCard";
import { DishEditDialog } from "@/components/DishEditDialog";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { SettingsPanel } from "@/components/SettingsPanel";

type Dish = {
  id: number; name: string; restaurant: string; area: string; distance: string;
  price: string; image: string; match: number; note: string; tags: string[]; likes: number;
};
type Analysis = {
  name: string; cuisine: string; ingredients: string; dietary: string;
  confidence: number; description: string;
  canonical: { dishName: string; cuisine: string; ingredients: string[]; flavours: string[]; metadataSource: "ai_normalized" | "user_reviewed" };
};
type AnalysisEnvelope =
  | { ok: true; mode: "live" | "demo"; requestId: string; result: Analysis; warning?: string }
  | { ok: false; mode: "unavailable"; requestId: string; error: { code: string; message: string }; demoAvailable: true };
type MatchResult = { kind: "dish" | "restaurant_alternative"; id: string; dishName: string | null; restaurantName: string; locality: string; distanceKm: number; score: number; reasonCode: "semantic_and_distance" | "nearby_alternative" | "restaurant_only"; provenance: string; verificationStatus: string; lastConfirmedAt: string | null; dietaryCaveat: string; currentAvailabilityConfirmed: boolean; priceAmount: number | null; currencyCode: string | null; imageUrl: string | null; attribution?: "Google Maps" };
type MatchTiers = { confirmedNearbyDishes: MatchResult[]; communityOrInferredDishes: MatchResult[]; restaurantLevelAlternatives: MatchResult[] };
type PublishRestaurant = { provider: "google" | "community"; providerPlaceId?: string | null; name: string; latitude: number; longitude: number; locality: string; administrativeRegion: string; countryCode: NormalizedLocation["countryCode"]; address: string; currencyCode: string };
type PublicationMetadata = { restaurant: PublishRestaurant; knowledge: { priceKnowledge: "unknown" | "exact" | "approximate"; priceAmount?: number; availabilityKnowledge: "unknown" | "recently_confirmed" | "historical"; lastConfirmedAt?: string }; retainImage: boolean; reviewConfirmed: true; restaurantConfirmed: true };
type PublishedDish = Analysis & { id: string; sourceMode: "live" | "demo"; imageUrl?: string | null; localPreview?: string; provenance?: string; verificationStatus?: string; availabilityKnowledge?: string; contributorLabel?: string; isOwner?: boolean; ownerId?: string; isSaved?: boolean; restaurant?: { name: string } | null; caption?: string; tasteNotes?: string; dietaryNotes?: string; personalComments?: string; locationTag?: string; moderationStatus?: string };
type GroupCandidate = { candidateId: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; price: string; image: string; score: number; eligible: boolean; tier: "fits" | "needs_checking" | "does_not_fit"; explanation: string; reasons: string[]; conflicts: string[]; kind: "published_dish" | "provider_restaurant" | "seed_demo"; provenance?: string | null; verificationStatus?: string | null; currentAvailabilityConfirmed: boolean; dietaryCaveat: string };
type GroupSnapshot = { id: string; name: string; eventTime: string; eventLocalDate: string | null; eventLocalTime: string | null; neighborhood: string; budgetMax: number; maxDistanceKm: number; distanceUnit: "metric" | "imperial"; allergies: string[]; dietaryRequirements: string[]; cuisineTypes: string[]; inviteCode: string; inviteExpiresAt: string | null; inviteRevokedAt: string | null; status: "voting" | "finalized"; selectedCandidateId: string | null; candidates: GroupCandidate[]; votes: Record<string, number>; rsvps: Record<string, number>; memberCount: number; viewerRole: "owner" | "participant"; viewerVote: string | null; viewerRsvp: string | null; timeZone: string | null; currencyCode: string | null; locale: string | null; locality: string | null; administrativeRegion?: string | null; countryCode: string | null; latitude?: number | null; longitude?: number | null };
type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;
type AnalyticsEvent = "analysis_started" | "analysis_completed" | "analysis_failed" | "analysis_corrected" | "dish_published" | "match_opened" | "group_created" | "invite_joined" | "vote_cast" | "plan_finalized" | "rsvp_submitted";
type FeedbackReason = "wrong_identification" | "stale_dish" | "closed_restaurant";

function groupConflictLabel(t: Translator, reason: string): string {
  const [code, detail = ""] = reason.split(":", 2);
  const keys: Record<string, MessageKey> = { price_unknown: "group.conflict.priceUnknown", over_budget: "group.conflict.overBudget", beyond_distance: "group.conflict.beyondDistance", vegetarian_unknown: "group.conflict.vegetarianUnknown", vegetarian_unsupported: "group.conflict.vegetarianUnsupported", allergen_unknown: "group.conflict.allergenUnknown", allergen_conflict: "group.conflict.allergenConflict", cuisine_unknown_or_mismatch: "group.conflict.cuisineUnknownOrMismatch" };
  return keys[code] ? t(keys[code], { allergen: detail }) : reason;
}

function groupCandidateCopy(t: Translator, candidate: GroupCandidate) {
  const dietaryCaveat = candidate.dietaryCaveat === "provider_information_unconfirmed" ? t("group.providerCaveat") : t("analysis.warning");
  return { dietaryCaveat };
}

const dishes: Dish[] = [
  { id: 1, name: "Brown butter agnolotti", restaurant: "Bar Susu", area: "Mount Pleasant", distance: "0.8 km", price: "$24", image: "/images/demo-pasta.jpg", match: 96, note: "Silky, nutty, bright with lemon", tags: ["Pasta", "Vegetarian"], likes: 284 },
  { id: 2, name: "Charred miso ramen", restaurant: "Maruhachi Ra-men", area: "West End", distance: "1.7 km", price: "$19", image: "/images/demo-ramen.jpg", match: 91, note: "Smoky broth, springy noodles, deep umami", tags: ["Japanese", "Cozy"], likes: 411 },
  { id: 3, name: "Crispy oyster mushroom tacos", restaurant: "La Taqueria", area: "Gastown", distance: "2.1 km", price: "$16", image: "/images/demo-tacos.jpg", match: 89, note: "Crunchy, tangy, chile-forward", tags: ["Mexican", "Plant-based"], likes: 356 },
  { id: 4, name: "Wood-fired stracciatella pizza", restaurant: "Via Tevere", area: "Commercial Drive", distance: "3.4 km", price: "$23", image: "/images/demo-pizza.jpg", match: 87, note: "Blistered crust, creamy centre, peppery finish", tags: ["Italian", "Shareable"], likes: 518 },
];
const sample: Analysis = {
  name: "Brown butter agnolotti", cuisine: "Northern Italian",
  ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
  dietary: "Vegetarian · Contains dairy and gluten", confidence: 94,
  description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
  canonical: { dishName: "agnolotti", cuisine: "northern italian", ingredients: ["filled pasta", "butter", "sage", "lemon", "parmesan"], flavours: ["nutty", "herbal", "bright"], metadataSource: "user_reviewed" },
};
const colors = ["#7a263a", "#c7654f", "#667449", "#b9772d"];
const emptyMatchTiers: MatchTiers = { confirmedNearbyDishes: [], communityOrInferredDishes: [], restaurantLevelAlternatives: [] };

export default function Home() {
  const { authenticated } = useAuth();
  const [view, setView] = useState<"discover" | "explore" | "groups" | "saved">("discover");
  const [exploreTab, setExploreTab] = useState<"public" | "following" | "people">("public");
  const [filter, setFilter] = useState("all");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "review" | "error" | "published">("idle");
  const [preview, setPreview] = useState(dishes[0].image);
  const [analysis, setAnalysis] = useState(sample);
  const [analysisMode, setAnalysisMode] = useState<"live" | "demo" | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisRequestId, setAnalysisRequestId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [toast, setToast] = useState("");
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [identityLabel, setIdentityLabel] = useState("Guest");
  const [communityFeed, setCommunityFeed] = useState<PublishedDish[]>([]);
  const [nearbyMatches, setNearbyMatches] = useState<MatchTiers>(emptyMatchTiers);
  const [matchProviderUnavailable, setMatchProviderUnavailable] = useState(false);
  const [matchRecordsUnavailable, setMatchRecordsUnavailable] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [language, setLanguage] = useState<UiLanguage>("en-CA");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [location, setLocation] = useState<NormalizedLocation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editDish, setEditDish] = useState<FeedDish | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const correctionTracked = useRef(false);
  const visible = useMemo(() => view === "saved" ? dishes.filter((d) => saved.has(d.id)) : dishes, [saved, view]);
  const t = useCallback<Translator>((key, values) => translate(language, key, values), [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLanguage = window.localStorage.getItem("trinque.language") as UiLanguage | null;
      const savedTheme = window.localStorage.getItem("trinque.theme");
      const savedMeasurement = window.localStorage.getItem("trinque.measurement");
      const savedLocation = window.localStorage.getItem("trinque.location");
      const restoredLanguage = savedLanguage && UI_LANGUAGES.includes(savedLanguage) ? savedLanguage : resolveUiLanguage(navigator.languages);
      setLanguage(restoredLanguage);
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setTheme(savedTheme);
      if (savedMeasurement === "metric" || savedMeasurement === "imperial") setMeasurementSystem(savedMeasurement);
      if (savedLocation) {
        try { setLocation(normalizeLocation(JSON.parse(savedLocation) as NormalizedLocation, restoredLanguage)); }
        catch { window.localStorage.removeItem("trinque.location"); }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncView = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has("join") || params.get("view") === "groups") setView("groups");
      else if (params.get("view") === "saved") setView("saved");
      else setView("discover");
      if (params.get("settings") === "1") setSettingsOpen(true);
    };
    const timer = window.setTimeout(syncView, 0);
    const openCapture = () => fileRef.current?.click();
    const switchView = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next === "discover" || next === "groups" || next === "saved") setView(next);
    };
    window.addEventListener("trinque:create", openCapture);
    window.addEventListener("trinque:view", switchView);
    window.addEventListener("popstate", syncView);
    return () => { window.clearTimeout(timer); window.removeEventListener("trinque:create", openCapture); window.removeEventListener("trinque:view", switchView); window.removeEventListener("popstate", syncView); };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = effective;
      document.documentElement.dataset.themePreference = theme;
      document.documentElement.lang = language;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [language, theme]);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const storedSessionToken = window.localStorage.getItem("trinque.sessionToken");
        const storedLegacyToken = window.localStorage.getItem("trinque.guestToken");
        let token: string | null = null;
        let displayName = "Guest";

        if (storedSessionToken) {
          const authResponse = await fetch("/api/auth/session", {
            headers: { Authorization: `Session ${storedSessionToken}` },
            cache: "no-store",
          });
          if (authResponse.ok) {
            const payload = await authResponse.json() as { authenticated: boolean; identity: { displayName: string } | null };
            if (payload.authenticated && payload.identity) {
              token = storedSessionToken;
              displayName = payload.identity.displayName;
            } else {
              window.localStorage.removeItem("trinque.sessionToken");
              if (storedLegacyToken === storedSessionToken) window.localStorage.removeItem("trinque.guestToken");
            }
          }
        }

        if (!token && storedLegacyToken && storedLegacyToken !== storedSessionToken) {
          const legacyResponse = await fetch("/api/session", { method: "POST", headers: { Authorization: `Guest ${storedLegacyToken}` } });
          if (legacyResponse.ok) {
            const session = await legacyResponse.json() as { identity: { displayName: string; authType?: "guest" | "chatgpt" | "supabase" }; guestToken?: string };
            token = session.guestToken ?? storedLegacyToken ?? (session.identity.authType === "chatgpt" ? "chatgpt-session" : null);
            displayName = session.identity.displayName;
            if (session.guestToken) window.localStorage.setItem("trinque.guestToken", session.guestToken);
          }
        }

        if (!token) {
          const guestResponse = await fetch("/api/session", { method: "POST" });
          if (guestResponse.ok) {
            const session = await guestResponse.json() as { identity: { displayName: string }; guestToken?: string };
            token = session.guestToken ?? null;
            displayName = session.identity.displayName;
            if (session.guestToken) window.localStorage.setItem("trinque.guestToken", session.guestToken);
          }
        }

        if (!active) return;
        setGuestToken(token);
        setIdentityLabel(displayName);
        const preferencesResponse = await fetch("/api/preferences", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (preferencesResponse.ok) {
          const payload = await preferencesResponse.json() as { preferences: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: NormalizedLocation | null } | null };
          if (active && payload.preferences) {
            if (payload.preferences.language) setLanguage(payload.preferences.language);
            if (payload.preferences.theme) setTheme(payload.preferences.theme);
            if (payload.preferences.measurementSystem) setMeasurementSystem(payload.preferences.measurementSystem);
            if (payload.preferences.location) setLocation(payload.preferences.location);
          }
        }
        const savesResponse = await fetch("/api/saves", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (savesResponse.ok) {
          const payload = await savesResponse.json() as { savedDishIds: number[] };
          if (active) setSaved(new Set(payload.savedDishIds));
        }
        const feedResponse = await fetch("/api/feed", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (feedResponse.ok) {
          const payload = await feedResponse.json() as { dishes: PublishedDish[] };
          if (active) setCommunityFeed(payload.dishes);
        }
      } catch {
        // The visual demo remains usable while durable services recover.
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  async function persistPreferences(next: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: NormalizedLocation | null }) {
    const nextLanguage = next.language ?? language;
    const nextTheme = next.theme ?? theme;
    const nextMeasurement = next.measurementSystem ?? measurementSystem;
    const storedLocation = next.location === undefined ? location : next.location;
    const nextLocation = storedLocation ? { ...storedLocation, language: nextLanguage, measurementSystem: nextMeasurement } : null;
    setLanguage(nextLanguage); setTheme(nextTheme); setMeasurementSystem(nextMeasurement); setLocation(nextLocation);
    window.localStorage.setItem("trinque.language", nextLanguage);
    window.dispatchEvent(new Event("trinque:language"));
    window.localStorage.setItem("trinque.theme", nextTheme);
    window.localStorage.setItem("trinque.measurement", nextMeasurement);
    if (nextLocation) window.localStorage.setItem("trinque.location", JSON.stringify(coarseLocation({ ...nextLocation, language: nextLanguage, measurementSystem: nextMeasurement })));
    else window.localStorage.removeItem("trinque.location");
    if (guestToken) {
      await fetch("/api/preferences", { method: "PUT", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ language: nextLanguage, theme: nextTheme, measurementSystem: nextMeasurement, location: nextLocation }) }).catch(() => undefined);
      if (next.location !== undefined) await fetch("/api/privacy", { method: "PUT", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ locationConsent: Boolean(nextLocation) }) }).catch(() => undefined);
    }
  }

  const flash = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  }, []);
  const trackAnalytics = useCallback((event: AnalyticsEvent, details: { mode?: "live" | "demo"; outcome?: string; durationMs?: number } = {}) => {
    if (!guestToken) return;
    void fetch("/api/analytics", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ event, language, countryCode: location?.countryCode, ...details }) }).catch(() => undefined);
  }, [guestToken, language, location?.countryCode]);
  const reportFeedback = useCallback(async (reason: FeedbackReason, targetType: "analysis" | "published_dish" | "restaurant", targetId?: string | null) => {
    if (!guestToken) return;
    const response = await fetch("/api/feedback", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason, targetType, targetId, countryCode: location?.countryCode }) }).catch(() => null);
    flash(response?.ok ? t("feedback.thanks") : t("error.generic"));
  }, [flash, guestToken, location?.countryCode, t]);
  function toggleSaved(id: number) {
    if (!authenticated) { window.location.assign("/auth/login?context=save&next=%2F%3Fview%3Dsaved"); return; }
    const shouldSave = !saved.has(id);
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); flash(t("save.removed")); }
      else { next.add(id); flash(t("save.added")); }
      return next;
    });
    if (guestToken) {
      void fetch("/api/saves", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ dishId: id, saved: shouldSave }) })
        .then((response) => { if (!response.ok) flash(t("save.offline")); })
        .catch(() => flash(t("save.offline")));
    }
  }
  function togglePublishedSaved(id: string) {
    if (!authenticated) { window.location.assign("/auth/login?context=save"); return; }
    const numericId = Number(id);
    if (Number.isFinite(numericId)) { toggleSaved(numericId); return; }
    if (!guestToken) return;
    const current = communityFeed.find((dish) => dish.id === id)?.isSaved ?? false;
    setCommunityFeed((items) => items.map((dish) => dish.id === id ? { ...dish, isSaved: !current } : dish));
    void fetch("/api/saves", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ dishId: id, saved: !current }) }).then((response) => { if (!response.ok) { setCommunityFeed((items) => items.map((dish) => dish.id === id ? { ...dish, isSaved: current } : dish)); flash(t("save.offline")); } });
  }
  function togglePublishedLike(id: string) {
    if (!authenticated || !guestToken) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    void fetch(`/api/dishes/${encodeURIComponent(id)}/like`, { method: "POST", headers: { Authorization: `Guest ${guestToken}` } }).then((response) => { if (!response.ok) flash(t("error.generic")); });
  }
  async function analyze(imageDataUrl?: string, demo = false) {
    const startedAt = performance.now();
    trackAnalytics("analysis_started", { mode: demo ? "demo" : "live" });
    setModal(true); setPhase("loading");
    setPendingImage(imageDataUrl); setAnalysisError(""); setAnalysisWarning(""); setAnalysisMode(null); setAnalysisRequestId(null); correctionTracked.current = false;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", ...(guestToken ? { Authorization: `Guest ${guestToken}` } : {}) },
        body: JSON.stringify({ imageDataUrl, demo, demoFixture: "pasta", language }),
      });
      const envelope = await response.json() as AnalysisEnvelope;
      if (!response.ok || !envelope.ok) {
        trackAnalytics("analysis_failed", { mode: demo ? "demo" : "live", outcome: envelope.ok ? "provider_error" : envelope.error.code, durationMs: Math.round(performance.now() - startedAt) });
        setAnalysisError(envelope.ok ? t("analysis.unavailableTitle") : t("analysis.networkError"));
        setPhase("error");
        return;
      }
      setAnalysis(envelope.result); setAnalysisMode(envelope.mode); setAnalysisWarning(envelope.warning ?? "");
      setAnalysisRequestId(envelope.requestId);
      trackAnalytics("analysis_completed", { mode: envelope.mode, outcome: "success", durationMs: Math.round(performance.now() - startedAt) });
      setPhase("review");
    } catch {
      trackAnalytics("analysis_failed", { mode: demo ? "demo" : "live", outcome: "network_error", durationMs: Math.round(performance.now() - startedAt) });
      setAnalysisError(t("analysis.networkError"));
      setPhase("error");
    }
  }
  async function deletePublishedDish(id: string, imageOnly = false) {
    if (!guestToken || !window.confirm(imageOnly ? t("privacy.deleteImage") : t("privacy.deleteDish"))) return;
    const response = await fetch(`/api/dishes/${id}${imageOnly ? "/image" : ""}`, { method: "DELETE", headers: { Authorization: `Guest ${guestToken}` } });
    if (!response.ok) { flash(t("error.generic")); return; }
    setCommunityFeed((current) => imageOnly ? current.map((dish) => dish.id === id ? { ...dish, imageUrl: null, localPreview: undefined } : dish) : current.filter((dish) => dish.id !== id));
  }
  function handleDishUpdated(id: string, fields: Record<string, string>) {
    setCommunityFeed((current) => current.map((dish) => dish.id === id ? { ...dish, ...fields } : dish));
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setPreview(value); void analyze(value); };
    reader.readAsDataURL(file);
  }
  function update(field: "name" | "cuisine" | "ingredients" | "dietary" | "description", value: string) {
    if (!correctionTracked.current) { correctionTracked.current = true; trackAnalytics("analysis_corrected", { mode: analysisMode ?? undefined }); }
    setAnalysis((current) => ({ ...current, [field]: value, canonical: { ...current.canonical, ...(field === "name" ? { dishName: value.trim().toLowerCase() } : {}), ...(field === "cuisine" ? { cuisine: value.trim().toLowerCase() } : {}), ...(field === "ingredients" ? { ingredients: value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) } : {}), metadataSource: "user_reviewed" } }));
  }
  async function publish(event: FormEvent, metadata: PublicationMetadata) {
    event.preventDefault();
    if (!guestToken || !analysisMode) {
      setAnalysisError(t("analysis.sessionError"));
      setPhase("error");
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch("/api/dishes", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ analysis, sourceMode: analysisMode, imageDataUrl: pendingImage, language, ...metadata }) });
      if (!response.ok) throw new Error("publish failed");
      const payload = await response.json() as { dish: PublishedDish; matches: MatchTiers; providerStatus: { status: "live" | "unavailable" }; matchingStatus: { status: "live" | "unavailable" } };
      setCommunityFeed((current) => [{ ...payload.dish, localPreview: preview, contributorLabel: t("comments.member") }, ...current.filter((dish) => dish.id !== payload.dish.id)]);
      setNearbyMatches(payload.matches);
      setMatchProviderUnavailable(payload.providerStatus.status === "unavailable");
      setMatchRecordsUnavailable(payload.matchingStatus.status === "unavailable");
      setPhase("published");
      trackAnalytics("dish_published", { mode: analysisMode, outcome: "success" });
      const count = payload.matches.confirmedNearbyDishes.length + payload.matches.communityOrInferredDishes.length + payload.matches.restaurantLevelAlternatives.length;
      flash(t("analysis.publishedBody", { count }));
    } catch {
      setAnalysisError(t("analysis.publishError"));
      setPhase("error");
    } finally { setPublishing(false); }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("discover")} aria-label={t("home.title")}><span>T</span>Trinque</button>
        <nav className="desktop-nav" aria-label={t("nav.discover")}>
          {(["discover", "explore", "groups", "saved"] as const).map((item) => (
            <button key={item} className={view === item ? "nav active" : "nav"} onClick={() => setView(item)}>
              {t(`nav.${item}`)}{item === "saved" && <i>{saved.size}</i>}
            </button>
          ))}
        </nav>
        <div className="top-actions"><NotificationBell /><button onClick={() => setSettingsOpen(true)} aria-label={t("settings.title")}>⚙</button><button aria-label={t("auth.openAccount")}>{authenticated ? identityLabel.slice(0, 2).toUpperCase() : "T"}</button></div>
      </header>

      <main>
        {view === "explore" ? (
          <section className="discover-section" style={{ paddingTop: 0 }}>
            <div className="section-heading">
              <div><span className="kicker">{t("nav.explore")}</span><h2>{t("home.title")}</h2></div>
              <div className="filters" role="group" aria-label={t("nav.explore")}>
                <button className={exploreTab === "public" ? "active" : ""} onClick={() => setExploreTab("public")}>{t("nav.public")}</button>
                <button className={exploreTab === "following" ? "active" : ""} onClick={() => setExploreTab("following")}>{t("nav.following")}</button>
                <button className={exploreTab === "people" ? "active" : ""} onClick={() => setExploreTab("people")}>{t("nav.people")}</button>
              </div>
            </div>
            {exploreTab === "people" ? (
              <DiscoverPeople />
            ) : communityFeed.length ? (
              <div className="feed-list">
                {communityFeed.map((dish) => {
                  const feedDish: FeedDish = { id: dish.id, name: dish.name, description: dish.description, caption: dish.caption, cuisine: dish.cuisine, confidence: dish.confidence, imageUrl: dish.imageUrl, localPreview: dish.localPreview, provenance: dish.provenance, verificationStatus: dish.verificationStatus, availabilityKnowledge: dish.availabilityKnowledge, contributorLabel: dish.contributorLabel, authorLabel: dish.contributorLabel, authorInitials: dish.contributorLabel?.slice(0,2).toUpperCase(), isOwner: dish.isOwner, isSaved: dish.isSaved, sourceMode: dish.sourceMode, restaurant: dish.restaurant, tasteNotes: dish.tasteNotes, dietaryNotes: dish.dietaryNotes, personalComments: dish.personalComments, contributorId: dish.ownerId };
                  return <FeedCard key={dish.id} dish={feedDish} t={t} language={language} onLike={togglePublishedLike} onSave={togglePublishedSaved} onDelete={dish.isOwner ? (id, img) => deletePublishedDish(id, img) : undefined} onEdit={dish.isOwner ? () => setEditDish(feedDish) : undefined} />;
                })}
              </div>
            ) : (
              <div className="empty-state"><span>◉</span><h3>{t("home.emptyTitle")}</h3><p>{t("home.emptyBody")}</p><button className="primary" onClick={() => setView("discover")}>{t("home.explore")}</button></div>
            )}
          </section>
        ) : view === "groups" ? (
          <GroupPlanner flash={flash} t={t} location={location} language={language} track={trackAnalytics} onRequestLocation={() => setSettingsOpen(true)} />
        ) : view === "saved" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span>✦</span> {t("nav.profile")}</div>
                <h1>{t("home.savedTitle")}</h1>
                <p>{t("home.savedBody")}</p>
              </div>
              <div className="taste-card">
                <b>{identityLabel}</b>
                <div className="taste-orbit"><span>T</span><i /><i /><i /></div>
                {saved.size > 0 && <small>{saved.size} {t("nav.saved")}</small>}
              </div>
            </section>
            <section className="discover-section">
              <div className="section-heading">
                <div><span className="kicker">{t("nav.saved")}</span><h2>{t("home.savedHeading")}</h2></div>
              </div>
              {visible.length ? <div className="dish-grid">
                {visible.map((dish, index) => <DishCard key={dish.id} dish={dish} featured={index === 0} isSaved={saved.has(dish.id)} onSave={toggleSaved} t={t} />)}
              </div> : <div className="empty-state"><span>♡</span><h3>{t("home.emptyTitle")}</h3><p>{t("home.emptyBody")}</p><button className="primary" onClick={() => setView("discover")}>{t("home.explore")}</button></div>}
            </section>
          </>
        ) : (
          <>
          <section className="discover-header">
            <div className="discover-header-left">
              <button className="compact-location" onClick={() => setSettingsOpen(true)} aria-label={t("location.change")}>
                {location?.locality ?? t("location.change")}
              </button>
              <div className="feed-filters" role="group" aria-label={t("home.gather")}>
                {["all", "near", "lessKnown"].map((item) => (
                  <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{t(`feed.${item}` as MessageKey)}</button>
                ))}
              </div>
            </div>
            <div className="discover-header-right">
              <button className="primary" onClick={() => fileRef.current?.click()}>＋ {t("home.analyze")}</button>
              <button className="text-button" onClick={() => { setPreview(dishes[0].image); void analyze(undefined, true); }}>{t("home.demo")} →</button>
              <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={handleFile} />
            </div>
          </section>

          {communityFeed.length ? (
            <div className="feed-list">
              {communityFeed.map((dish) => {
                const feedDish: FeedDish = { id: dish.id, name: dish.name, description: dish.description, caption: dish.caption, cuisine: dish.cuisine, confidence: dish.confidence, imageUrl: dish.imageUrl, localPreview: dish.localPreview, provenance: dish.provenance, verificationStatus: dish.verificationStatus, availabilityKnowledge: dish.availabilityKnowledge, contributorLabel: dish.contributorLabel, authorLabel: dish.contributorLabel, authorInitials: dish.contributorLabel?.slice(0,2).toUpperCase(), isOwner: dish.isOwner, isSaved: dish.isSaved, sourceMode: dish.sourceMode, restaurant: dish.restaurant, tasteNotes: dish.tasteNotes, dietaryNotes: dish.dietaryNotes, personalComments: dish.personalComments, contributorId: dish.ownerId };
                return <FeedCard key={dish.id} dish={feedDish} t={t} language={language} onLike={togglePublishedLike} onSave={togglePublishedSaved} onDelete={dish.isOwner ? (id, img) => deletePublishedDish(id, img) : undefined} onEdit={dish.isOwner ? () => setEditDish(feedDish) : undefined} />;
              })}
            </div>
          ) : (
            <div className="empty-state"><span>♡</span><h3>{t("home.emptyTitle")}</h3><p>{t("home.emptyBody")}</p><button className="primary" onClick={() => fileRef.current?.click()}>{t("home.analyze")}</button></div>
          )}
          </>
        )}
      </main>

      <nav className="mobile-nav" aria-label={t("nav.discover")}>
        <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span>⌂</span>{t("nav.discover")}</button>
        <button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}><span>◉</span>{t("nav.explore")}</button>
        <button className="mobile-add" onClick={() => fileRef.current?.click()} aria-label={t("nav.post")}>＋</button>
        <button className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}><span>♢</span>{t("nav.groups")}</button>
        <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}><span>○</span>{t("nav.profile")}</button>
      </nav>
      {modal && <Analyzer key={`${pendingImage ?? "demo"}-${analysisMode ?? "pending"}`} guestToken={guestToken} preview={preview} phase={phase} analysis={analysis} analysisMode={analysisMode} warning={analysisWarning} error={analysisError} matches={nearbyMatches} matchProviderUnavailable={matchProviderUnavailable} matchRecordsUnavailable={matchRecordsUnavailable} publishing={publishing} close={() => setModal(false)} update={update} publish={publish} retry={() => void analyze(pendingImage, false)} demo={() => void analyze(undefined, true)} t={t} language={language} measurementSystem={measurementSystem} location={location} onMatchOpened={() => trackAnalytics("match_opened", { mode: analysisMode ?? undefined })} onFeedback={(reason, targetType, targetId) => void reportFeedback(reason, targetType, targetId ?? analysisRequestId)} />}
      {settingsOpen && <SettingsPanel guestToken={guestToken} t={t} language={language} theme={theme} measurementSystem={measurementSystem} location={location} close={() => setSettingsOpen(false)} persist={persistPreferences} />}
      {editDish && <DishEditDialog dish={editDish} t={t} guestToken={guestToken} onClose={() => setEditDish(null)} onUpdated={(fields) => { handleDishUpdated(editDish.id, fields); setEditDish(null); }} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function DishCard({ dish, featured, isSaved, onSave, t }: { dish: Dish; featured: boolean; isSaved: boolean; onSave: (id: number) => void; t: Translator }) {
  return <article className={featured ? "dish-card featured" : "dish-card"}>
    <div className="dish-image" style={{ backgroundImage: "linear-gradient(180deg,transparent 58%,rgba(22,13,10,.62)),url(" + dish.image + ")" }}>
      <span className="match"><b>{dish.match}%</b> {t("match.label")}</span>
      <button className={isSaved ? "save saved" : "save"} onClick={() => onSave(dish.id)} aria-label={t(isSaved ? "save.removed" : "save.added")}>{isSaved ? "♥" : "♡"}</button>
      <div className="photo-caption"><b>{dish.restaurant}</b><small>{dish.area}</small></div>
    </div>
    <div className="dish-body">
      <div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.note}</p></div><strong>{dish.price}</strong></div>
      <div className="dish-meta"><div>{dish.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small>{dish.distance} · ♥ {dish.likes}</small></div>
      {featured && <button className="find-button">{t("analysis.explore")} <span>→</span></button>}
    </div>
  </article>;
}

function Analyzer({ guestToken, preview, phase, analysis, analysisMode, warning, error, matches, matchProviderUnavailable, matchRecordsUnavailable, publishing, close, update, publish, retry, demo, t, language, measurementSystem, location, onMatchOpened, onFeedback }: { guestToken: string | null; preview: string; phase: string; analysis: Analysis; analysisMode: "live" | "demo" | null; warning: string; error: string; matches: MatchTiers; matchProviderUnavailable: boolean; matchRecordsUnavailable: boolean; publishing: boolean; close: () => void; update: (field: "name" | "cuisine" | "ingredients" | "dietary" | "description", value: string) => void; publish: (event: FormEvent, metadata: PublicationMetadata) => void; retry: () => void; demo: () => void; t: Translator; language: UiLanguage; measurementSystem: MeasurementSystem; location: NormalizedLocation | null; onMatchOpened: () => void; onFeedback: (reason: FeedbackReason, targetType: "analysis" | "published_dish" | "restaurant", targetId?: string | null) => void }) {
  const { authenticated } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantPlace[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<PublishRestaurant | null>(null);
  const [restaurantStatus, setRestaurantStatus] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [priceKnowledge, setPriceKnowledge] = useState<"" | "unknown" | "exact" | "approximate">("");
  const [priceAmount, setPriceAmount] = useState("");
  const [availabilityKnowledge, setAvailabilityKnowledge] = useState<"" | "unknown" | "recently_confirmed" | "historical">("");
  const [lastConfirmedAt, setLastConfirmedAt] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [restaurantConfirmed, setRestaurantConfirmed] = useState(false);
  const [retainImage, setRetainImage] = useState(false);
  const [tasteNotes, setTasteNotes] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [personalComments, setPersonalComments] = useState("");

  async function findRestaurants() {
    if (!location) { setRestaurantStatus(t("publish.noLocation")); return; }
    setRestaurantStatus("");
    try {
      const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), radiusMeters: "5000", language, dishName: analysis.name, cuisine: analysis.cuisine });
      const response = await fetch(`/api/restaurants/nearby?${query}`, { headers: guestToken ? { Authorization: `Guest ${guestToken}` } : undefined });
      const body = await response.json() as { restaurants?: RestaurantPlace[]; error?: { code?: string } };
      if (!response.ok) { setRestaurantStatus(body.error?.code === "credentials" ? t("publish.providerUnavailable") : t("location.providerError")); return; }
      setRestaurants(body.restaurants ?? []);
      if (!(body.restaurants ?? []).length) setRestaurantStatus(t("publish.noDishMatches"));
    } catch { setRestaurantStatus(t("location.providerError")); }
  }

  function selectProviderRestaurant(place: RestaurantPlace) {
    setSelectedRestaurant({ provider: "google", providerPlaceId: place.providerPlaceId, name: place.displayName, latitude: place.latitude, longitude: place.longitude, locality: place.locality, administrativeRegion: place.administrativeRegion, countryCode: place.countryCode, address: place.address, currencyCode: place.currencyCode });
    setRestaurantConfirmed(false);
  }

  function useManualRestaurant() {
    if (!location || !manualName.trim() || !manualAddress.trim()) { setRestaurantStatus(location ? t("publish.requirements") : t("publish.noLocation")); return; }
    setSelectedRestaurant({ provider: "community", name: manualName.trim(), latitude: location.latitude, longitude: location.longitude, locality: location.locality, administrativeRegion: location.administrativeRegion, countryCode: location.countryCode, address: manualAddress.trim(), currencyCode: location.currencyCode });
    setRestaurantConfirmed(false);
  }

  const validPrice = priceKnowledge === "unknown" || ((priceKnowledge === "exact" || priceKnowledge === "approximate") && Number(priceAmount) > 0);
  const validAvailability = availabilityKnowledge === "unknown" || availabilityKnowledge === "recently_confirmed" || (availabilityKnowledge === "historical" && Boolean(lastConfirmedAt));
  const ready = Boolean(selectedRestaurant && priceKnowledge && availabilityKnowledge && validPrice && validAvailability && reviewConfirmed && restaurantConfirmed);
  function submit(event: FormEvent) {
    if (!authenticated) { event.preventDefault(); window.location.assign("/auth/login?context=publish&next=%2F%23capture"); return; }
    if (!ready || !selectedRestaurant || !priceKnowledge || !availabilityKnowledge) { event.preventDefault(); setRestaurantStatus(t("publish.requirements")); return; }
    publish(event, { restaurant: selectedRestaurant, knowledge: { priceKnowledge, priceAmount: priceKnowledge === "unknown" ? undefined : Number(priceAmount), availabilityKnowledge, lastConfirmedAt: availabilityKnowledge === "historical" ? lastConfirmedAt : undefined }, retainImage, reviewConfirmed: true, restaurantConfirmed: true, tasteNotes: tasteNotes.trim() || undefined, dietaryNotes: dietaryNotes.trim() || undefined, personalComments: personalComments.trim() || undefined });
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="analyzer-title"><div className="analyzer">
    <button className="modal-close" onClick={close} aria-label={t("settings.close")}>×</button>
    <div className="analyzer-image" style={{ backgroundImage: "url(" + preview + ")" }}><span>✦ {t("analysis.live")}</span></div>
    <div className="analyzer-content">
      {phase === "loading" ? <div className="loading-state"><div className="scan"><span /></div><em>{t("analysis.loadingKicker")}</em><h2 id="analyzer-title">{t("analysis.loadingTitle")}</h2><div><span>{t("analysis.field.name")}</span><span>{t("analysis.field.ingredients")}</span><span>{t("analysis.field.dietary")}</span></div></div>
      : phase === "error" ? <div className="identifier-error"><span>!</span><p className="kicker">{t("analysis.unavailableKicker")}</p><h2 id="analyzer-title">{t("analysis.unavailableTitle")}</h2><p>{error}</p><div className="modal-actions"><button type="button" className="secondary" onClick={demo}>{t("analysis.useDemo")}</button><button type="button" className="primary" onClick={retry}>{t("analysis.retry")}</button></div></div>
      : phase === "published" ? <div className="published"><span>✓</span><h2 id="analyzer-title">{t("analysis.publishedTitle")}</h2><p>{t("analysis.publishedBody", { count: matches.confirmedNearbyDishes.length + matches.communityOrInferredDishes.length + matches.restaurantLevelAlternatives.length })}</p>{matchRecordsUnavailable && <p className="publication-status">{t("match.recordsUnavailable")}</p>}{matchProviderUnavailable && <p className="publication-status">{t("match.providerUnavailable")}</p>}<MatchTier title={t("match.confirmedTier")} results={matches.confirmedNearbyDishes} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /><MatchTier title={t("match.communityTier")} results={matches.communityOrInferredDishes} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /><MatchTier title={t("match.restaurantTier")} results={matches.restaurantLevelAlternatives} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /><div className="modal-actions"><button className="primary" onClick={() => { onMatchOpened(); close(); }}>{t("analysis.explore")} →</button></div></div>
      : <form onSubmit={submit}><div className={`analysis-mode ${analysisMode ?? ""}`}>{analysisMode === "live" ? `● ${t("analysis.live")}` : `◇ ${t("analysis.demo")}`}</div><span className="kicker">{t("analysis.review")}</span><div className="confidence"><h2 id="analyzer-title">{t("analysis.reviewTitle")}</h2><span>{t("analysis.confident", { confidence: analysis.confidence })}</span></div>
        {warning && <p className="demo-warning">{warning}</p>}
        <p className="review-note">{t("analysis.warning")}</p>
        <button type="button" className="text-button" onClick={() => onFeedback("wrong_identification", "analysis")}>{t("feedback.wrongIdentification")}</button>
        <div className="form-grid">
          <label className="wide">{t("analysis.field.name")}<input value={analysis.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>{t("analysis.field.cuisine")}<input value={analysis.cuisine} onChange={(e) => update("cuisine", e.target.value)} /></label>
          <label>{t("analysis.field.dietary")}<input value={analysis.dietary} onChange={(e) => update("dietary", e.target.value)} /></label>
          <label className="wide">{t("analysis.field.ingredients")}<textarea value={analysis.ingredients} onChange={(e) => update("ingredients", e.target.value)} /></label>
          <label className="wide">{t("analysis.field.description")}<textarea value={analysis.description} onChange={(e) => update("description", e.target.value)} /></label>
          <label className="wide">{t("analysis.field.tasteNotes")}<textarea value={tasteNotes} onChange={(e) => setTasteNotes(e.target.value)} /></label>
          <label className="wide">{t("analysis.field.dietaryNotes")}<textarea value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)} /></label>
          <label className="wide">{t("analysis.field.personalComments")}<textarea value={personalComments} onChange={(e) => setPersonalComments(e.target.value)} /></label>
        </div>
        <p className="canonical-note">{t("analysis.canonicalNotice")}</p>
        <section className="publication-section"><h3>{t("publish.restaurantTitle")}</h3><p>{t("publish.restaurantHelp")}</p>
          <button type="button" className="secondary" onClick={() => void findRestaurants()}>{t("publish.findRestaurants")}</button><p className="restaurant-search-note">{t("publish.dishSearchNotice")}</p>
          {restaurants.length > 0 && <div className="restaurant-results">{restaurants.map((place) => <button type="button" key={place.providerPlaceId} onClick={() => selectProviderRestaurant(place)} className={selectedRestaurant?.providerPlaceId === place.providerPlaceId ? "selected" : ""}><b>{place.displayName}{place.rating != null && <span className="place-rating" aria-label={t("restaurant.rating", { rating: place.rating.toFixed(1) })}>{"★".repeat(Math.round(place.rating))}{"☆".repeat(5 - Math.round(place.rating))} <em>{place.rating.toFixed(1)}</em></span>}</b><small>{place.address}</small></button>)}<small className="google-attribution" translate="no">{t("publish.googleAttribution")}</small></div>}
          {restaurantStatus && <p className="publication-status">{restaurantStatus}</p>}
          <div className="manual-restaurant"><b>{t("publish.manualRestaurant")}</b><input aria-label={t("publish.restaurantName")} placeholder={t("publish.restaurantName")} value={manualName} onChange={(event) => setManualName(event.target.value)} /><input aria-label={t("publish.restaurantAddress")} placeholder={t("publish.restaurantAddress")} value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} /><button type="button" className="secondary" onClick={useManualRestaurant}>{t("publish.selectRestaurant")}</button></div>
          {selectedRestaurant && <p className="selected-restaurant">✓ {t("publish.selectedRestaurant", { restaurant: selectedRestaurant.name })}</p>}
        </section>
        <section className="publication-section"><h3>{t("publish.knowledgeTitle")}</h3><div className="knowledge-grid"><label>{t("publish.priceKnowledge")}<select value={priceKnowledge} onChange={(event) => setPriceKnowledge(event.target.value as typeof priceKnowledge)}><option value="">—</option><option value="unknown">{t("publish.priceUnknown")}</option><option value="exact">{t("publish.priceExact")}</option><option value="approximate">{t("publish.priceApproximate")}</option></select></label>{(priceKnowledge === "exact" || priceKnowledge === "approximate") && <label>{t("publish.priceAmount", { currency: location?.currencyCode ?? selectedRestaurant?.currencyCode ?? "" })}<input type="number" min="0.01" step="0.01" value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} /></label>}<label>{t("publish.availabilityKnowledge")}<select value={availabilityKnowledge} onChange={(event) => setAvailabilityKnowledge(event.target.value as typeof availabilityKnowledge)}><option value="">—</option><option value="unknown">{t("publish.availabilityUnknown")}</option><option value="recently_confirmed">{t("publish.availabilityRecent")}</option><option value="historical">{t("publish.availabilityHistorical")}</option></select></label>{availabilityKnowledge === "historical" && <label>{t("publish.lastSeen")}<input type="date" max={new Date().toISOString().slice(0, 10)} value={lastConfirmedAt} onChange={(event) => setLastConfirmedAt(event.target.value)} /></label>}</div>
          <p className="provenance-preview">{t("publish.provenancePreview", { provenance: t(analysisMode === "demo" ? "provenance.seed_demo" : "provenance.ai_identified"), verification: t("verification.unverified"), availability: t(availabilityKnowledge === "recently_confirmed" ? "availability.confirmed" : "availability.unknown") })}</p>
          <label className="confirmation"><input type="checkbox" checked={retainImage} onChange={(event) => setRetainImage(event.target.checked)} />{t("publish.retainImage")}</label><p className="privacy-note">{t("privacy.imageRetentionDetails")}</p>
          <label className="confirmation"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />{t("publish.reviewConfirm")}</label><label className="confirmation"><input type="checkbox" checked={restaurantConfirmed} onChange={(event) => setRestaurantConfirmed(event.target.checked)} disabled={!selectedRestaurant} />{t("publish.restaurantConfirm")}</label>
        </section>
        <div className="modal-actions"><button type="button" className="secondary" onClick={close}>{t("analysis.keepPrivate")}</button><button className="primary" type="submit" disabled={publishing || !ready}>{publishing ? t("analysis.publishing") : `${t("analysis.publish")} →`}</button></div>
      </form>}
    </div>
  </div></div>;
}

function MatchTier({ title, results, t, language, measurementSystem, onFeedback }: { title: string; results: MatchResult[]; t: Translator; language: UiLanguage; measurementSystem: MeasurementSystem; onFeedback: (reason: FeedbackReason, targetType: "analysis" | "published_dish" | "restaurant", targetId?: string | null) => void }) {
  return <section className="match-tier"><h3>{title}</h3>{results.length === 0 ? <p className="empty-tier">{t("match.noResults")}</p> : <div className="nearby-results">{results.slice(0, 4).map((match) => {
    const distance = new Intl.NumberFormat(language, { style: "unit", unit: measurementSystem === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(measurementSystem === "imperial" ? match.distanceKm * .621371 : match.distanceKm);
    const provenance = match.provenance === "provider_place" ? t("match.providerPlace") : t(`provenance.${match.provenance}` as MessageKey);
    const verification = match.verificationStatus === "not_applicable" ? t("match.notApplicable") : t(`verification.${match.verificationStatus}` as MessageKey);
    const reason = t(match.reasonCode === "restaurant_only" ? "match.restaurantReason" : match.reasonCode === "semantic_and_distance" ? "match.semanticReason" : "match.nearbyReason");
    const price = match.priceAmount != null && match.currencyCode ? new Intl.NumberFormat(language, { style: "currency", currency: match.currencyCode }).format(match.priceAmount) : null;
    return <article key={match.id}>{match.imageUrl ? <Image src={match.imageUrl} alt="" width={640} height={480} sizes="(max-width: 768px) 100vw, 320px" unoptimized /> : <div className="match-placeholder">T</div>}<div><b>{match.dishName ?? match.restaurantName}</b><small>{match.dishName ? `${match.restaurantName} · ` : ""}{distance} · {match.score}%{price ? ` · ${price}` : ""}</small><p>{reason}</p><small>{provenance} · {verification}</small><small>{match.lastConfirmedAt ? t("match.lastConfirmed", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(match.lastConfirmedAt)) }) : t("match.neverConfirmed")}</small><small>{match.currentAvailabilityConfirmed ? t("availability.confirmed") : t("availability.unknown")}</small><p className="dietary-caveat">{match.dietaryCaveat === "provider_information_unconfirmed" ? t("group.providerCaveat") : t("analysis.warning")}</p>{match.attribution && <small translate="no">Google Maps</small>}<button className="text-button" onClick={() => onFeedback(match.kind === "dish" ? "stale_dish" : "closed_restaurant", match.kind === "dish" ? "published_dish" : "restaurant", match.id)}>{t(match.kind === "dish" ? "feedback.staleDish" : "feedback.closedRestaurant")}</button></div></article>;
  })}</div>}</section>;
}

function GroupPlanner({ flash, t, language, track }: { flash: (text: string) => void; t: Translator; language: UiLanguage; track: (event: AnalyticsEvent, details?: { mode?: "live" | "demo"; outcome?: string; durationMs?: number }) => void }) {
  const { authenticated, authHeaders, sessionToken } = useAuth();
  const sessionHeaders = useMemo(() => authHeaders(), [authHeaders]);
  const [group, setGroup] = useState<GroupSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);
  const [budgetMax, setBudgetMax] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"metric" | "imperial">("metric");
  const [allergies, setAllergies] = useState("");
  const [dietaryRequirements, setDietaryRequirements] = useState<string[]>([]);
  const [cuisineTypes, setCuisineTypes] = useState("");
  const [eventLocalDate, setEventLocalDate] = useState("");
  const [eventLocalTime, setEventLocalTime] = useState("");
  const [groupLocation, setGroupLocation] = useState<NormalizedLocation | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  useEffect(() => {
    void fetch("/api/health").then(async (response) => {
      const health = await response.json() as { capabilities?: { places?: { status?: string } } };
      setPlacesUnavailable(health.capabilities?.places?.status !== "available");
    }).catch(() => setPlacesUnavailable(true));
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    const inviteCode = new URLSearchParams(window.location.search).get("join");
    if (inviteCode && !joinAttempted.current) {
      joinAttempted.current = true;
      void fetch("/api/groups/join", { method: "POST", headers: { ...sessionHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode, language }) }).then(async (response) => { if (!response.ok) { flash(t("group.inviteInvalid")); return; } setGroup(((await response.json()) as { group: GroupSnapshot }).group); window.history.replaceState({}, "", window.location.pathname); track("invite_joined", { outcome: "success" }); flash(t("group.joined")); });
      return;
    }
    void fetch("/api/groups", { headers: sessionHeaders }).then(async (response) => { if (response.ok) setGroup(((await response.json()) as { group: GroupSnapshot | null }).group); });
  }, [flash, language, sessionHeaders, sessionToken, t, track]);

  async function searchLocation(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setLocationBusy(true); setLocationStatus(""); setLocationSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json", ...sessionHeaders }, body: JSON.stringify({ ...payload, language, location: groupLocation ?? null }) });
      const body = await response.json() as { suggestions?: LocationSuggestion[]; location?: NormalizedLocation; error?: { code?: string } };
      if (!response.ok) { setLocationStatus(body.error?.code === "unsupported_country" ? t("location.unsupported") : body.error?.code === "credentials" ? t("location.unavailable") : t("location.providerError")); setLocationBusy(false); return; }
      if (body.location) { const selected = { ...body.location, language, measurementSystem: body.location.measurementSystem ?? "metric" }; setGroupLocation(selected); setLocationSuggestions([]); setLocationQuery(`${selected.locality}, ${selected.countryCode}`); setLocationBusy(false); return; }
      setLocationSuggestions(body.suggestions ?? []); setLocationBusy(false);
    } catch { setLocationStatus(t("location.unavailable")); setLocationBusy(false); }
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
    if (groupLocation) { setGroupLocation(null); setLocationQuery(""); } else { setLocationSuggestions([]); }
  }

  async function createGroup() {
    if (!authenticated) { window.location.assign("/auth/login?context=group&next=%2F%3Fview%3Dgroups"); return; }
    if (!sessionToken) { flash(t("auth.connecting")); return; }
    if (!groupLocation) { setLocationStatus(t("location.choose")); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/groups", { method: "POST", headers: { ...sessionHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ name: t("group.name"), eventLocalDate: eventLocalDate || undefined, eventLocalTime: eventLocalTime || undefined, location: groupLocation, language, budgetMax: Number(budgetMax) || undefined, maxDistance: Number(maxDistanceKm) || undefined, distanceUnit, allergies: allergies.split(","), dietaryRequirements, cuisineTypes: cuisineTypes.split(",") }) });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { code?: string } | null;
        if (failure?.code === "profile_incomplete") { window.location.assign("/onboarding"); return; }
        throw new Error();
      }
      const payload = await response.json() as { group: GroupSnapshot; providerStatus?: { status: "live" | "unavailable" } };
      setGroup(payload.group); setPlacesUnavailable(payload.providerStatus?.status === "unavailable"); flash(t("group.rank"));
      track("group_created", { outcome: "success" });
    } catch { flash(t("error.generic")); } finally { setBusy(false); }
  }

  async function groupAction(path: string, body?: object) {
    if (!sessionToken || !group) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${group.id}/${path}`, { method: "POST", headers: { ...sessionHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error);
      const payload = await response.json() as { group: GroupSnapshot };
      setGroup(payload.group); flash(path === "vote" ? t("group.voteSaved") : path === "finalize" ? t("group.finalized") : t("group.rsvpSaved"));
      if (path === "vote") track("vote_cast", { outcome: "success" }); else if (path === "finalize") track("plan_finalized", { outcome: "success" }); else if (path === "rsvp") track("rsvp_submitted", { outcome: "success" });
    } catch { flash(t("error.generic")); } finally { setBusy(false); }
  }

  async function downloadCalendar() {
    if (!sessionToken || !group) return;
    const response = await fetch(`/api/groups/${group.id}/calendar`, { headers: sessionHeaders });
    if (!response.ok) { flash(t("error.generic")); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "trinque-plan.ics"; link.click(); URL.revokeObjectURL(url); flash(t("group.calendarDownloaded"));
  }

  function changePlan() {
    if (!group) return;
    setBudgetMax(String(group.budgetMax));
    setMaxDistanceKm(String(group.distanceUnit === "imperial" ? Math.round(group.maxDistanceKm * 0.621371 * 10) / 10 : group.maxDistanceKm));
    setDistanceUnit(group.distanceUnit);
    setAllergies(group.allergies.join(", "));
    setDietaryRequirements(group.dietaryRequirements);
    setCuisineTypes(group.cuisineTypes.join(", "));
    if (group.eventLocalDate) setEventLocalDate(group.eventLocalDate);
    if (group.eventLocalTime) setEventLocalTime(group.eventLocalTime);
    setGroupLocation(group.locality && group.countryCode && typeof group.latitude === "number" && typeof group.longitude === "number" ? { latitude: group.latitude, longitude: group.longitude, locality: group.locality, countryCode: group.countryCode, administrativeRegion: group.administrativeRegion ?? "", language, measurementSystem: "metric", timeZone: group.timeZone ?? "", locale: group.locale ?? language, currencyCode: group.currencyCode ?? "", source: "manual" } : null);
    setGroup(null);
  }

  if (!group) return <section className="group-page"><div className="group-intro"><div className="eyebrow"><span>♢</span> {t("group.eyebrow")}</div><h1>{t("group.createTitle")}</h1><p>{t("group.createBody")}</p></div><div className="group-starter"><span className="kicker">{t("group.start")}</span><h2>{t("group.name")}</h2><div className="group-location-row"><div><span>{t("settings.location")}</span><b>{groupLocation ? t("location.current", { location: `${groupLocation.locality}, ${groupLocation.countryCode}` }) : t("location.choose")}</b></div><button className="group-location-button" type="button" onClick={useDeviceLocation}><span aria-hidden="true">⌖</span>{t("location.useDevice")}</button></div><div className="location-search"><form onSubmit={(event: FormEvent) => { event.preventDefault(); if (locationQuery.trim()) void searchLocation({ input: locationQuery.trim() }); }}><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={t("location.search")} /><button disabled={locationBusy || !locationQuery.trim()}>{t("location.searchAction")}</button></form><button className="text-button" onClick={useSavedArea}>{groupLocation ? t("location.clear") : t("location.useSaved")}</button>{locationBusy && <p className="location-status">{t("location.searching")}</p>}{locationStatus && <p className="location-status warning">{locationStatus}</p>}<div className="location-suggestions">{locationSuggestions.map((suggestion) => <button key={suggestion.id} onClick={() => void searchLocation({ providerPlaceId: suggestion.providerPlaceId })}><b>{suggestion.label}</b><br /><small>{suggestion.secondaryLabel}</small></button>)}{locationSuggestions.length > 0 && <small className="google-attribution" translate="no">Google Maps</small>}</div></div><div className="planner-form"><label>{t("group.date")}<input type="date" value={eventLocalDate} onChange={(event) => setEventLocalDate(event.target.value)} /></label><label>{t("group.time")}<input type="time" value={eventLocalTime} onChange={(event) => setEventLocalTime(event.target.value)} /></label><label>{t("group.budget")}<input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} inputMode="numeric" placeholder={t("group.budgetPlaceholder")} /></label><label>{t("group.radius")}<div className="distance-input"><input value={maxDistanceKm} onChange={(event) => setMaxDistanceKm(event.target.value)} inputMode="numeric" placeholder={t("group.radiusPlaceholder")} /><select aria-label={t("group.distanceUnit")} value={distanceUnit} onChange={(event) => setDistanceUnit(event.target.value as "metric" | "imperial")}><option value="metric">{t("location.metric")}</option><option value="imperial">{t("location.imperial")}</option></select></div></label><fieldset><legend>{t("group.dietary")}</legend>{["vegan", "vegetarian", "celiac", "gluten-free", "dairy-free", "nut-free", "shellfish-free", "halal", "kosher"].map((item) => <label key={item}><input type="checkbox" checked={dietaryRequirements.includes(item)} onChange={(event) => setDietaryRequirements((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{t(`diet.${item}` as MessageKey)}</label>)}</fieldset><label>{t("group.allergies")}<input value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder={t("group.allergyExample")} /></label><label>{t("group.cuisines")}<input value={cuisineTypes} onChange={(event) => setCuisineTypes(event.target.value)} placeholder={t("group.cuisineExample")} /></label></div>{!groupLocation && <p className="location-status warning">{t("location.choose")}</p>}<button className="primary full" disabled={busy || (authenticated && (!sessionToken || !groupLocation || !eventLocalDate || !eventLocalTime))} onClick={createGroup}>{busy ? t("group.building") : authenticated ? t("group.rank") : t("auth.signIn")}</button></div></section>;

  const tierOrder = { fits: 0, needs_checking: 1, does_not_fit: 2 };
  const sortedCandidates = [...group.candidates].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.score - a.score || a.distanceKm - b.distanceKm);
  const fitCandidates = sortedCandidates.filter((c) => c.tier === "fits").slice(0, 5);
  const checkCandidates = sortedCandidates.filter((c) => c.tier === "needs_checking").slice(0, 5);
  const noFitCandidates = sortedCandidates.filter((c) => c.tier === "does_not_fit").slice(0, 5);

  const winner = group.candidates.find((candidate) => candidate.candidateId === group.selectedCandidateId);
  const winnerCopy = winner ? groupCandidateCopy(t, winner) : null;

  function renderCandidate(candidate: GroupCandidate, index: number) {
    const distance = new Intl.NumberFormat(language, { style: "unit", unit: group.distanceUnit === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(group.distanceUnit === "imperial" ? candidate.distanceKm * .621371 : candidate.distanceKm);
    const canVote = candidate.tier !== "does_not_fit" && group.status === "voting";
    const tierLabel = candidate.tier === "fits" ? t("group.fitEligible") : candidate.tier === "needs_checking" ? t("group.needsCheck") : t("group.hardConflict");
    const isWinner = candidate.candidateId === group.selectedCandidateId;
    return <article className={`vote-card${isWinner ? " winner" : ""}${candidate.tier === "does_not_fit" ? " ineligible" : ""}`} key={candidate.candidateId}><div className="vote-image" style={candidate.image ? { backgroundImage: `url(${candidate.image})` } : undefined}><span>{candidate.tier === "fits" ? `#${index + 1}` : "!"}</span></div><div className="vote-copy"><div><span>{tierLabel}</span><h3>{candidate.restaurant}</h3><p>{candidate.name} · {candidate.price} · {distance}</p>{candidate.conflicts.map((reason, i) => <small key={i}>{groupConflictLabel(t, reason)}</small>)}{candidate.kind === "provider_restaurant" ? <small>{t("match.restaurantReason")}</small> : <small>{`${t(`provenance.${candidate.provenance ?? "community_submitted"}` as MessageKey)} · ${t(`verification.${candidate.verificationStatus ?? "unverified"}` as MessageKey)}`} · {candidate.currentAvailabilityConfirmed ? t("availability.confirmed") : t("availability.unknown")}</small>}<small>{candidate.dietaryCaveat === "provider_information_unconfirmed" ? t("group.providerCaveat") : t("analysis.warning")}</small></div>{canVote && <button disabled={busy || group.status === "finalized"} onClick={() => void groupAction("vote", { candidateId: candidate.candidateId })}>▲ <b>{group.votes[candidate.candidateId] ?? 0}</b></button>}</div></article>;
  }
  return <section className="group-page">
    <div className="group-intro"><div className="eyebrow"><span>♢</span> {t("group.eyebrow")}</div><h1>{group.status === "finalized" ? t("group.finalTitle") : t("group.voteTitle")}</h1><p>{t("group.constraints")}</p>{placesUnavailable && <p className="location-status warning">{t("match.providerUnavailable")}</p>}<div className="members"><span style={{ background: colors[0] }}>{t("group.memberCount", { count: group.memberCount })}</span></div></div>
    <div className="planner"><aside className="constraints"><span className="kicker">{new Intl.DateTimeFormat(language, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: group.timeZone ?? "UTC" }).format(new Date(group.eventTime))}</span><h2>{group.name}</h2>{[["◎", group.locality ?? group.neighborhood, new Intl.NumberFormat(language, { style: "unit", unit: group.distanceUnit === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(group.distanceUnit === "imperial" ? group.maxDistanceKm * .621371 : group.maxDistanceKm)], ["$", new Intl.NumberFormat(group.locale ?? language, { style: "currency", currency: group.currencyCode ?? "CAD", maximumFractionDigits: 0 }).format(group.budgetMax), t("group.budget")], ["!", group.allergies.join(", ") || "—", t("group.allergies")]].map(([icon, title, note], index) => <div className={index === 2 && group.allergies.length ? "constraint warning" : "constraint"} key={`${icon}-${title}`}><span>{icon}</span><div><b>{title}</b><small>{note}</small></div></div>)}{group.viewerRole === "owner" && <><button className="secondary full" onClick={changePlan}>{t("group.changePlan")}</button>{!group.inviteRevokedAt && <><button className="secondary full" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/?join=${group.inviteCode}`); flash(t("group.inviteCopied")); }}>{t("group.copyInvite")}</button><button className="text-button full" onClick={() => void groupAction("invite/revoke")}>{t("group.revokeInvite")}</button></>}</>}</aside>
      <div className="shortlist"><div className="section-heading"><div><span className="kicker">{t("group.ranking")}</span><h2>{group.status === "voting" ? t("group.bestFits") : t("group.finalPlan")}</h2></div></div>
        {sortedCandidates.length === 0 && <p className="empty-tier">{t("group.noLiveCandidates")}</p>}
        {sortedCandidates.length > 0 && fitCandidates.length === 0 && checkCandidates.length === 0 && <p className="empty-tier">{t("group.noEligibleCandidates")}</p>}
        {fitCandidates.map((c, i) => renderCandidate(c, i))}
        {checkCandidates.length > 0 && <><div className="section-heading shortlist-secondary"><div><span className="kicker">{t("group.ranking")}</span><h2>{t("group.placesToCheck")}</h2></div></div>{checkCandidates.map((c, i) => renderCandidate(c, i))}</>}
        {noFitCandidates.length > 0 && <><div className="section-heading shortlist-secondary"><div><span className="kicker">{t("group.ranking")}</span><h2>{t("group.noFit")}</h2></div></div>{noFitCandidates.map((c, i) => renderCandidate(c, i))}</>}
        {group.status === "voting" && group.viewerRole === "owner" ? <button className="primary plan-button" disabled={busy} onClick={() => void groupAction("finalize")}>{t("group.lock")} →</button> : group.status === "voting" ? <p className="privacy-note">{t("group.ownerFinalizes")}</p> : winner && winnerCopy ? <div className="final-plan"><span>✦ {t("group.bestTable")}</span><h3>{winner.restaurant}</h3><p>{winner.name} · {new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone: group.timeZone ?? "UTC" }).format(new Date(group.eventTime))}.</p><div><button className="primary" onClick={() => void groupAction("rsvp", { status: "yes" })}>{t("group.rsvpYes")} · {group.rsvps.yes ?? 0}</button><button className="secondary" onClick={() => void downloadCalendar()}>{t("group.calendar")}</button></div></div> : null}
      </div>
    </div>
  </section>;
}
