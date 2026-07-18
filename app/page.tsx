"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coarseLocation, normalizeLocation, type NormalizedLocation } from "@/lib/location";
import type { LocationSuggestion } from "@/lib/places/types";
import { REGIONAL_DEFAULTS, type MeasurementSystem, type ThemePreference } from "@/lib/regions";
import { LANGUAGE_LABEL_KEYS, resolveUiLanguage, translate, UI_LANGUAGES, type MessageKey, type UiLanguage } from "@/ios/i18n";

type Dish = {
  id: number; name: string; restaurant: string; area: string; distance: string;
  price: string; image: string; match: number; note: string; tags: string[]; likes: number;
};
type Analysis = {
  name: string; cuisine: string; ingredients: string; dietary: string;
  confidence: number; description: string;
};
type AnalysisEnvelope =
  | { ok: true; mode: "live" | "demo"; requestId: string; result: Analysis; warning?: string }
  | { ok: false; mode: "unavailable"; requestId: string; error: { code: string; message: string }; demoAvailable: true };
type NearbyMatch = { id: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; price: string; image: string; dietary: string; score: number; explanation: string };
type PublishedDish = Analysis & { id: string; sourceMode: "live" | "demo"; imageUrl?: string | null; localPreview?: string };
type GroupCandidate = { candidateId: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; price: string; image: string; score: number; eligible: boolean; explanation: string; conflicts: string[] };
type GroupSnapshot = { id: string; name: string; eventTime: string; neighborhood: string; budgetMax: number; maxDistanceKm: number; vegetarianRequired: number; allergies: string[]; inviteCode: string; status: "voting" | "finalized"; selectedCandidateId: string | null; candidates: GroupCandidate[]; votes: Record<string, number>; rsvps: Record<string, number> };
type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

const dishes: Dish[] = [
  { id: 1, name: "Brown butter agnolotti", restaurant: "Bar Susu", area: "Mount Pleasant", distance: "0.8 km", price: "$24", image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=86", match: 96, note: "Silky, nutty, bright with lemon", tags: ["Pasta", "Vegetarian"], likes: 284 },
  { id: 2, name: "Charred miso ramen", restaurant: "Maruhachi Ra-men", area: "West End", distance: "1.7 km", price: "$19", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=86", match: 91, note: "Smoky broth, springy noodles, deep umami", tags: ["Japanese", "Cozy"], likes: 411 },
  { id: 3, name: "Crispy oyster mushroom tacos", restaurant: "La Taqueria", area: "Gastown", distance: "2.1 km", price: "$16", image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=86", match: 89, note: "Crunchy, tangy, chile-forward", tags: ["Mexican", "Plant-based"], likes: 356 },
  { id: 4, name: "Wood-fired stracciatella pizza", restaurant: "Via Tevere", area: "Commercial Drive", distance: "3.4 km", price: "$23", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=86", match: 87, note: "Blistered crust, creamy centre, peppery finish", tags: ["Italian", "Shareable"], likes: 518 },
];
const sample: Analysis = {
  name: "Brown butter agnolotti", cuisine: "Northern Italian",
  ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
  dietary: "Vegetarian · Contains dairy and gluten", confidence: 94,
  description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
};
const colors = ["#7a263a", "#c7654f", "#667449", "#b9772d"];

export default function Home() {
  const [view, setView] = useState<"discover" | "groups" | "saved">("discover");
  const [filter, setFilter] = useState("For you");
  const [saved, setSaved] = useState<Set<number>>(new Set([2]));
  const [modal, setModal] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "review" | "error" | "published">("idle");
  const [preview, setPreview] = useState(dishes[0].image);
  const [analysis, setAnalysis] = useState(sample);
  const [analysisMode, setAnalysisMode] = useState<"live" | "demo" | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [toast, setToast] = useState("");
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [identityLabel, setIdentityLabel] = useState("Guest");
  const [publishedDishes, setPublishedDishes] = useState<PublishedDish[]>([]);
  const [nearbyMatches, setNearbyMatches] = useState<NearbyMatch[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [language, setLanguage] = useState<UiLanguage>("en-CA");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [location, setLocation] = useState<NormalizedLocation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
        const storedToken = window.localStorage.getItem("trinque.guestToken");
        const sessionResponse = await fetch("/api/session", { method: "POST", headers: storedToken ? { Authorization: `Guest ${storedToken}` } : undefined });
        if (!sessionResponse.ok) return;
        const session = await sessionResponse.json() as { identity: { displayName: string }; guestToken?: string };
        const token = session.guestToken ?? storedToken;
        if (!active) return;
        if (session.guestToken) window.localStorage.setItem("trinque.guestToken", session.guestToken);
        setGuestToken(token);
        setIdentityLabel(session.identity.displayName);
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
        const dishesResponse = await fetch("/api/dishes", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (dishesResponse.ok) {
          const payload = await dishesResponse.json() as { dishes: PublishedDish[] };
          if (active) setPublishedDishes(payload.dishes);
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
    window.localStorage.setItem("trinque.theme", nextTheme);
    window.localStorage.setItem("trinque.measurement", nextMeasurement);
    if (nextLocation) window.localStorage.setItem("trinque.location", JSON.stringify(coarseLocation({ ...nextLocation, language: nextLanguage, measurementSystem: nextMeasurement })));
    else window.localStorage.removeItem("trinque.location");
    if (guestToken) {
      await fetch("/api/preferences", { method: "PUT", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ language: nextLanguage, theme: nextTheme, measurementSystem: nextMeasurement, location: nextLocation }) }).catch(() => undefined);
    }
  }

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  }
  function toggleSaved(id: number) {
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
  async function analyze(imageDataUrl?: string, demo = false) {
    setModal(true); setPhase("loading");
    setPendingImage(imageDataUrl); setAnalysisError(""); setAnalysisWarning(""); setAnalysisMode(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, demo, demoFixture: "pasta" }),
      });
      const envelope = await response.json() as AnalysisEnvelope;
      if (!response.ok || !envelope.ok) {
        setAnalysisError(envelope.ok ? "Live identification failed." : envelope.error.message);
        setPhase("error");
        return;
      }
      setAnalysis(envelope.result); setAnalysisMode(envelope.mode); setAnalysisWarning(envelope.warning ?? "");
      setPhase("review");
    } catch {
      setAnalysisError(t("analysis.networkError"));
      setPhase("error");
    }
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setPreview(value); void analyze(value); };
    reader.readAsDataURL(file);
  }
  function update(field: keyof Analysis, value: string) {
    setAnalysis((current) => ({ ...current, [field]: field === "confidence" ? Number(value) : value }));
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!guestToken || !analysisMode) {
      setAnalysisError(t("analysis.sessionError"));
      setPhase("error");
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch("/api/dishes", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ analysis, sourceMode: analysisMode, imageDataUrl: pendingImage }) });
      if (!response.ok) throw new Error("publish failed");
      const payload = await response.json() as { dish: PublishedDish; matches: NearbyMatch[] };
      setPublishedDishes((current) => [{ ...payload.dish, localPreview: preview }, ...current.filter((dish) => dish.id !== payload.dish.id)]);
      setNearbyMatches(payload.matches);
      setPhase("published");
      flash(`Dish published — ${payload.matches.length} nearby matches ready`);
    } catch {
      setAnalysisError(t("analysis.publishError"));
      setPhase("error");
    } finally { setPublishing(false); }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("discover")} aria-label="Trinque home"><span>T</span>Trinque</button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {(["discover", "groups", "saved"] as const).map((item) => (
            <button key={item} className={view === item ? "nav active" : "nav"} onClick={() => setView(item)}>
              {t(`nav.${item}`)}{item === "saved" && <i>{saved.size}</i>}
            </button>
          ))}
        </nav>
        <div className="top-actions"><button onClick={() => setSettingsOpen(true)} aria-label={t("settings.title")}>⚙</button><button aria-label={`Profile: ${identityLabel}`}>{identityLabel === "Guest explorer" ? "GE" : identityLabel.slice(0, 2).toUpperCase()}</button></div>
      </header>

      <main>
        {view === "groups" ? (
          <GroupPlanner guestToken={guestToken} flash={flash} t={t} location={location} language={language} />
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span>✦</span> {t("home.eyebrow")}</div>
                <h1>{view === "saved" ? t("home.savedTitle") : t("home.title")}</h1>
                <p>{view === "saved" ? t("home.savedBody") : t("home.body")}</p>
                {view === "discover" && <div className="hero-actions">
                  <button className="primary" onClick={() => fileRef.current?.click()}>＋ {t("home.analyze")}</button>
                  <button className="text-button" onClick={() => { setPreview(dishes[0].image); void analyze(undefined, true); }}>{t("home.demo")} →</button>
                  <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={handleFile} />
                </div>}
              </div>
              <div className="taste-card">
                <b>Your tasteprint</b><div className="taste-orbit"><span>CO</span><i /><i /><i /></div>
                <div className="taste-tags"><span>Smoky</span><span>Bright</span><span>Comforting</span></div>
                <small>12 new matches this week</small>
              </div>
            </section>

            <section className="discover-section">
              <div className="section-heading">
                <div><span className="kicker">{t("home.curated", { location: location?.locality ?? "—" })}</span><h2>{view === "saved" ? t("home.savedHeading") : t("home.gather")}</h2></div>
                {view === "discover" && <div className="filters" role="group" aria-label="Feed filters">
                  {["For you", "Near you", "Hidden gems"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
                </div>}
              </div>
              {view !== "saved" && <p className="seeded-notice">{t("home.seededNotice")}</p>}
              {visible.length ? <div className="dish-grid">
                {view === "discover" && publishedDishes.map((dish) => <PublishedDishCard key={dish.id} dish={dish} t={t} />)}
                {visible.map((dish, index) => <DishCard key={dish.id} dish={dish} featured={index === 0 && view === "discover"} isSaved={saved.has(dish.id)} onSave={toggleSaved} t={t} />)}
              </div> : <div className="empty-state"><span>♡</span><h3>{t("home.emptyTitle")}</h3><p>{t("home.emptyBody")}</p><button className="primary" onClick={() => setView("discover")}>{t("home.explore")}</button></div>}
            </section>

            {view === "discover" && <section className="insider-strip">
              <div className="insider-number">03</div>
              <div><span className="kicker">{t("home.localNote")}</span><h2>Ask for the off-menu chile crisp.</h2><p>{t("home.localTip")}</p></div>
              <div className="people">{["AM", "JR", "SK"].map((name, i) => <span key={name} style={{ background: colors[i] }}>{name}</span>)}<small>18 locals agree</small></div>
            </section>}
          </>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span>⌂</span>{t("nav.discover")}</button>
        <button className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}><span>♢</span>{t("nav.groups")}</button>
        <button className="mobile-add" onClick={() => fileRef.current?.click()} aria-label={t("home.analyze")}>＋</button>
        <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}><span>♡</span>{t("nav.saved")}</button>
        <button onClick={() => setSettingsOpen(true)}><span>○</span>{t("nav.profile")}</button>
      </nav>
      {modal && <Analyzer preview={preview} phase={phase} analysis={analysis} analysisMode={analysisMode} warning={analysisWarning} error={analysisError} matches={nearbyMatches} publishing={publishing} close={() => setModal(false)} update={update} publish={publish} retry={() => void analyze(pendingImage, false)} demo={() => void analyze(undefined, true)} t={t} language={language} measurementSystem={measurementSystem} />}
      {settingsOpen && <SettingsPanel t={t} language={language} theme={theme} measurementSystem={measurementSystem} location={location} close={() => setSettingsOpen(false)} persist={persistPreferences} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function DishCard({ dish, featured, isSaved, onSave, t }: { dish: Dish; featured: boolean; isSaved: boolean; onSave: (id: number) => void; t: Translator }) {
  return <article className={featured ? "dish-card featured" : "dish-card"}>
    <div className="dish-image" style={{ backgroundImage: "linear-gradient(180deg,transparent 58%,rgba(22,13,10,.62)),url(" + dish.image + ")" }}>
      <span className="match"><b>{dish.match}%</b> taste match</span>
      <button className={isSaved ? "save saved" : "save"} onClick={() => onSave(dish.id)} aria-label={(isSaved ? "Remove " : "Save ") + dish.name}>{isSaved ? "♥" : "♡"}</button>
      <div className="photo-caption"><b>{dish.restaurant}</b><small>{dish.area}</small></div>
    </div>
    <div className="dish-body">
      <div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.note}</p></div><strong>{dish.price}</strong></div>
      <div className="dish-meta"><div>{dish.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small>{dish.distance} · ♥ {dish.likes}</small></div>
      {featured && <button className="find-button">{t("analysis.explore")} <span>→</span></button>}
    </div>
  </article>;
}

function PublishedDishCard({ dish, t }: { dish: PublishedDish; t: Translator }) {
  return <article className="dish-card published-card">
    <div className="dish-image" style={{ backgroundImage: `linear-gradient(180deg,transparent 55%,rgba(22,13,10,.68)),url(${dish.localPreview ?? dish.imageUrl ?? dishes[0].image})` }}><span className="match"><b>NEW</b> {t("analysis.publishedTitle")}</span><div className="photo-caption"><b>{dish.sourceMode === "live" ? t("analysis.live") : t("analysis.demo")}</b><small>{t("analysis.review")}</small></div></div>
    <div className="dish-body"><div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.description}</p></div><strong>{dish.confidence}%</strong></div><div className="dish-meta"><div><span>{dish.cuisine}</span></div><small>{t("analysis.review")}</small></div></div>
  </article>;
}

function Analyzer({ preview, phase, analysis, analysisMode, warning, error, matches, publishing, close, update, publish, retry, demo, t, language, measurementSystem }: { preview: string; phase: string; analysis: Analysis; analysisMode: "live" | "demo" | null; warning: string; error: string; matches: NearbyMatch[]; publishing: boolean; close: () => void; update: (field: keyof Analysis, value: string) => void; publish: (event: FormEvent) => void; retry: () => void; demo: () => void; t: Translator; language: UiLanguage; measurementSystem: MeasurementSystem }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="analyzer-title"><div className="analyzer">
    <button className="modal-close" onClick={close} aria-label="Close analyzer">×</button>
    <div className="analyzer-image" style={{ backgroundImage: "url(" + preview + ")" }}><span>✦ GPT-5.6 vision</span></div>
    <div className="analyzer-content">
      {phase === "loading" ? <div className="loading-state"><div className="scan"><span /></div><em>{t("analysis.loadingKicker")}</em><h2 id="analyzer-title">{t("analysis.loadingTitle")}</h2><div><span>{t("analysis.field.name")}</span><span>{t("analysis.field.ingredients")}</span><span>{t("analysis.field.dietary")}</span></div></div>
      : phase === "error" ? <div className="identifier-error"><span>!</span><p className="kicker">{t("analysis.unavailableKicker")}</p><h2 id="analyzer-title">{t("analysis.unavailableTitle")}</h2><p>{error}</p><div className="modal-actions"><button type="button" className="secondary" onClick={demo}>{t("analysis.useDemo")}</button><button type="button" className="primary" onClick={retry}>{t("analysis.retry")}</button></div></div>
      : phase === "published" ? <div className="published"><span>✓</span><h2 id="analyzer-title">{t("analysis.publishedTitle")}</h2><p>{t("analysis.publishedBody", { count: matches.length })}</p><div className="nearby-results">{matches.slice(0, 3).map((match) => <article key={match.id}><img src={match.image} alt="" /><div><b>{match.name}</b><small>{match.restaurant} · {new Intl.NumberFormat(language, { style: "unit", unit: measurementSystem === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(measurementSystem === "imperial" ? match.distanceKm * .621371 : match.distanceKm)}</small><p>{match.score}% · {match.explanation}</p></div></article>)}</div><div className="modal-actions"><button className="primary" onClick={close}>{t("analysis.explore")} →</button></div></div>
      : <form onSubmit={publish}><div className={`analysis-mode ${analysisMode ?? ""}`}>{analysisMode === "live" ? `● ${t("analysis.live")}` : `◇ ${t("analysis.demo")}`}</div><span className="kicker">{t("analysis.review")}</span><div className="confidence"><h2 id="analyzer-title">{t("analysis.reviewTitle")}</h2><span>{t("analysis.confident", { confidence: analysis.confidence })}</span></div>
        {warning && <p className="demo-warning">{warning}</p>}
        <p className="review-note">{t("analysis.warning")}</p>
        <div className="form-grid">
          <label className="wide">{t("analysis.field.name")}<input value={analysis.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>{t("analysis.field.cuisine")}<input value={analysis.cuisine} onChange={(e) => update("cuisine", e.target.value)} /></label>
          <label>{t("analysis.field.dietary")}<input value={analysis.dietary} onChange={(e) => update("dietary", e.target.value)} /></label>
          <label className="wide">{t("analysis.field.ingredients")}<textarea value={analysis.ingredients} onChange={(e) => update("ingredients", e.target.value)} /></label>
          <label className="wide">{t("analysis.field.description")}<textarea value={analysis.description} onChange={(e) => update("description", e.target.value)} /></label>
        </div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>{t("analysis.keepPrivate")}</button><button className="primary" type="submit" disabled={publishing}>{publishing ? t("analysis.publishing") : `${t("analysis.publish")} →`}</button></div>
      </form>}
    </div>
  </div></div>;
}

function SettingsPanel({ t, language, theme, measurementSystem, location, close, persist }: { t: Translator; language: UiLanguage; theme: ThemePreference; measurementSystem: MeasurementSystem; location: NormalizedLocation | null; close: () => void; persist: (next: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: NormalizedLocation | null }) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) {
    setBusy(true); setStatus(""); setSuggestions([]);
    try {
      const response = await fetch("/api/locations/autocomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, language, location }) });
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
    <div className="setting-block"><span>{t("settings.language")}</span><div className="setting-options">{UI_LANGUAGES.map((item) => <button key={item} className={language === item ? "active" : ""} onClick={() => void persist({ language: item })}>{t(LANGUAGE_LABEL_KEYS[item])}</button>)}</div></div>
    <div className="setting-block"><span>{t("settings.theme")}</span><div className="setting-options">{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} onClick={() => void persist({ theme: item })}>{t(`settings.theme.${item}`)}</button>)}</div></div>
    <div className="setting-block"><span>{t("settings.measurement")}</span><div className="setting-options">{(["metric", "imperial"] as const).map((item) => <button key={item} className={measurementSystem === item ? "active" : ""} onClick={() => void persist({ measurementSystem: item })}>{t(item === "metric" ? "location.metric" : "location.imperial")}</button>)}</div></div>
    <div className="setting-block"><span>{t("settings.location")}</span>{location && <p className="location-status">{t("location.current", { location: `${location.locality}, ${location.countryCode}` })}</p>}<button className="location-chip" disabled={busy} onClick={useDeviceLocation}>{t("location.useDevice")}</button><form className="location-search" onSubmit={(event) => { event.preventDefault(); if (query.trim()) void search({ input: query.trim() }); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("location.search")} /><button disabled={busy || !query.trim()}>{t("location.searchAction")}</button></form>{status && <p className="location-status warning">{status}</p>}<div className="location-suggestions">{suggestions.map((suggestion) => <button key={suggestion.id} onClick={() => void selectSuggestion(suggestion)}><b>{suggestion.label}</b><br /><small>{suggestion.secondaryLabel}</small></button>)}{suggestions.length > 0 && <small className="google-attribution" translate="no">Google Maps</small>}</div><p className="privacy-note">{t("location.privacy")}</p></div>
  </aside></div>;
}

function GroupPlanner({ guestToken, flash, t, location, language }: { guestToken: string | null; flash: (text: string) => void; t: Translator; location: NormalizedLocation | null; language: UiLanguage }) {
  const [group, setGroup] = useState<GroupSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [budgetMax, setBudgetMax] = useState("35");
  const [maxDistanceKm, setMaxDistanceKm] = useState("4");
  const [vegetarianRequired, setVegetarianRequired] = useState("1");
  const [allergies, setAllergies] = useState("sesame");

  useEffect(() => {
    if (!guestToken) return;
    void fetch("/api/groups", { headers: { Authorization: `Guest ${guestToken}` } }).then(async (response) => {
      if (response.ok) setGroup(((await response.json()) as { group: GroupSnapshot | null }).group);
    });
  }, [guestToken]);

  async function createGroup() {
    if (!guestToken) { flash("Guest session is still connecting"); return; }
    if (!location) { flash(t("location.change")); return; }
    setBusy(true);
    try {
      const eventTime = new Date(Date.now() + 24 * 60 * 60 * 1000); eventTime.setHours(19, 30, 0, 0);
      const response = await fetch("/api/groups", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: t("group.name"), eventTime: eventTime.toISOString(), neighborhood: location.locality, budgetMax: Number(budgetMax), maxDistanceKm: Number(maxDistanceKm), vegetarianRequired: Number(vegetarianRequired), allergies: allergies.split(",") }) });
      if (!response.ok) throw new Error();
      setGroup(((await response.json()) as { group: GroupSnapshot }).group); flash(t("group.rank"));
    } catch { flash(t("error.generic")); } finally { setBusy(false); }
  }

  async function groupAction(path: string, body?: object) {
    if (!guestToken || !group) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${group.id}/${path}`, { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error);
      const payload = await response.json() as { group: GroupSnapshot };
      setGroup(payload.group); flash(path === "vote" ? t("group.voteSaved") : path === "finalize" ? t("group.finalized") : t("group.rsvpSaved"));
    } catch { flash(t("error.generic")); } finally { setBusy(false); }
  }

  async function downloadCalendar() {
    if (!guestToken || !group) return;
    const response = await fetch(`/api/groups/${group.id}/calendar`, { headers: { Authorization: `Guest ${guestToken}` } });
    if (!response.ok) { flash(t("error.generic")); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "trinque-plan.ics"; link.click(); URL.revokeObjectURL(url); flash(t("group.calendarDownloaded"));
  }

  if (!group) return <section className="group-page"><div className="group-intro"><div className="eyebrow"><span>♢</span> {t("group.eyebrow")}</div><h1>{t("group.createTitle")}</h1><p>{t("group.createBody")}</p></div><div className="group-starter"><span className="kicker">{t("group.start")}</span><h2>{t("group.name")}</h2><div className="planner-form"><label>{t("group.budget")}<input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} inputMode="numeric" /></label><label>{t("group.radius")}<input value={maxDistanceKm} onChange={(event) => setMaxDistanceKm(event.target.value)} inputMode="numeric" /></label><label>{t("group.vegetarian")}<input value={vegetarianRequired} onChange={(event) => setVegetarianRequired(event.target.value)} inputMode="numeric" /></label><label>{t("group.allergies")}<input value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="sesame, peanuts" /></label></div>{!location && <p className="location-status warning">{t("location.change")}</p>}<button className="primary full" disabled={busy || !guestToken || !location} onClick={createGroup}>{guestToken ? busy ? t("group.building") : `${t("group.rank")} →` : t("auth.connecting")}</button></div></section>;

  const winner = group.candidates.find((candidate) => candidate.candidateId === group.selectedCandidateId);
  return <section className="group-page">
    <div className="group-intro"><div className="eyebrow"><span>♢</span> {t("group.eyebrow")}</div><h1>{group.status === "finalized" ? t("group.finalTitle") : t("group.voteTitle")}</h1><p>{t("group.constraints")}</p><div className="members">{["YOU", "+3"].map((name, index) => <span key={name} style={{ background: colors[index] }}>{name}</span>)}</div></div>
    <div className="planner"><aside className="constraints"><span className="kicker">{new Intl.DateTimeFormat(language, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: location?.timeZone }).format(new Date(group.eventTime))}</span><h2>{group.name}</h2>{[["◎", group.neighborhood, group.maxDistanceKm.toString()], ["$", new Intl.NumberFormat(location?.locale ?? language, { style: "currency", currency: location?.currencyCode ?? "CAD", maximumFractionDigits: 0 }).format(group.budgetMax), t("group.budget")], ["!", group.allergies.join(", ") || "—", t("group.allergies")], ["♧", group.vegetarianRequired.toString(), t("group.vegetarian")]].map(([icon, title, note], index) => <div className={index === 2 && group.allergies.length ? "constraint warning" : "constraint"} key={`${icon}-${title}`}><span>{icon}</span><div><b>{title}</b><small>{note}</small></div></div>)}<button className="secondary full" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/?join=${group.inviteCode}`); flash(t("group.inviteCopied")); }}>{t("group.copyInvite")}</button></aside>
      <div className="shortlist"><div className="section-heading"><div><span className="kicker">{t("group.ranking")}</span><h2>{group.status === "voting" ? t("group.bestFits") : t("group.finalPlan")}</h2></div><span className="live">● D1</span></div>
        {group.candidates.slice(0, 5).map((candidate, index) => <article className={`${candidate.eligible && index === 0 ? "vote-card winner" : "vote-card"} ${candidate.eligible ? "" : "ineligible"}`} key={candidate.candidateId}><div className="vote-image" style={{ backgroundImage: `url(${candidate.image})` }}><span>{candidate.eligible ? `#${index + 1}` : "!"}</span></div><div className="vote-copy"><div><span>{candidate.eligible ? t("group.groupFit", { score: candidate.score }) : t("group.hardConflict")}</span><h3>{candidate.restaurant}</h3><p>{candidate.name} · {candidate.price} · {candidate.distanceKm} km</p><small>{candidate.explanation}</small></div><button disabled={busy || !candidate.eligible || group.status === "finalized"} onClick={() => void groupAction("vote", { candidateId: candidate.candidateId })}>▲ <b>{group.votes[candidate.candidateId] ?? 0}</b></button></div></article>)}
        {group.status === "voting" ? <button className="primary plan-button" disabled={busy} onClick={() => void groupAction("finalize")}>{t("group.lock")} →</button> : winner ? <div className="final-plan"><span>✦ {t("group.bestTable")}</span><h3>{winner.restaurant}</h3><p>{winner.name} · {new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone: location?.timeZone }).format(new Date(group.eventTime))}. {winner.explanation}</p><div><button className="primary" onClick={() => void groupAction("rsvp", { status: "yes" })}>{t("group.rsvpYes")} · {group.rsvps.yes ?? 0}</button><button className="secondary" onClick={() => void downloadCalendar()}>{t("group.calendar")}</button></div></div> : null}
      </div>
    </div>
  </section>;
}
