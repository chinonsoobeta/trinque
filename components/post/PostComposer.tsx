"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { MatchTier } from "@/components/post/MatchTier";
import { usePreferences } from "@/components/PreferencesProvider";
import { useToast } from "@/components/ToastProvider";
import { useAnalytics } from "@/components/useAnalytics";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import {
  demoAnalysis, demoAnalysisImage, emptyMatchTiers,
  type Analysis, type AnalysisEnvelope, type FeedbackReason,
  type MatchTiers, type PublicationMetadata, type PublishRestaurant, type PublishedDish,
} from "@/components/post/types";
import type { RestaurantPlace } from "@/lib/places/types";

type Phase = "capture" | "loading" | "review" | "error" | "published";

/**
 * Capture → analyse → publish, as one route rather than a modal reachable only
 * from the home screen. Each phase replaces the one before it, so the back
 * button and a refresh both do something sensible.
 */
export function PostComposer() {
  const { authenticated, authHeaders, sessionToken } = useAuth();
  const { location } = usePreferences();
  const { flash } = useToast();
  const track = useAnalytics();
  const t = useUiText();
  const language = useUiLanguage();

  const [phase, setPhase] = useState<Phase>("capture");
  const [preview, setPreview] = useState(demoAnalysisImage);
  const [analysis, setAnalysis] = useState<Analysis>(demoAnalysis);
  const [analysisMode, setAnalysisMode] = useState<"live" | "demo" | null>(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [matches, setMatches] = useState<MatchTiers>(emptyMatchTiers);
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const [recordsUnavailable, setRecordsUnavailable] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const correctionTracked = useRef(false);

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

  async function reportFeedback(reason: FeedbackReason, targetType: "analysis" | "published_dish" | "restaurant", targetId?: string | null) {
    if (!sessionToken) return;
    const response = await fetch("/api/feedback", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ reason, targetType, targetId: targetId ?? requestId, countryCode: location?.countryCode }) }).catch(() => null);
    flash(response?.ok ? t("feedback.thanks") : t("error.generic"));
  }

  async function analyze(imageDataUrl?: string, demo = false) {
    const startedAt = performance.now();
    track("analysis_started", { mode: demo ? "demo" : "live" });
    setPhase("loading");
    setPendingImage(imageDataUrl); setError(""); setWarning(""); setAnalysisMode(null); setRequestId(null);
    correctionTracked.current = false;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ imageDataUrl, demo, demoFixture: "pasta", language }),
      });
      const envelope = await response.json() as AnalysisEnvelope;
      if (!response.ok || !envelope.ok) {
        track("analysis_failed", { mode: demo ? "demo" : "live", outcome: envelope.ok ? "provider_error" : envelope.error.code, durationMs: Math.round(performance.now() - startedAt) });
        setError(envelope.ok ? t("analysis.unavailableTitle") : t("analysis.networkError"));
        setPhase("error");
        return;
      }
      setAnalysis(envelope.result); setAnalysisMode(envelope.mode); setWarning(envelope.warning ?? "");
      setRequestId(envelope.requestId);
      track("analysis_completed", { mode: envelope.mode, outcome: "success", durationMs: Math.round(performance.now() - startedAt) });
      setPhase("review");
    } catch {
      track("analysis_failed", { mode: demo ? "demo" : "live", outcome: "network_error", durationMs: Math.round(performance.now() - startedAt) });
      setError(t("analysis.networkError"));
      setPhase("error");
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setPreview(value); void analyze(value); };
    reader.readAsDataURL(file);
  }

  function update(field: "name" | "cuisine" | "ingredients" | "dietary" | "description", value: string) {
    if (!correctionTracked.current) { correctionTracked.current = true; track("analysis_corrected", { mode: analysisMode ?? undefined }); }
    setAnalysis((current) => ({
      ...current, [field]: value,
      canonical: {
        ...current.canonical,
        ...(field === "name" ? { dishName: value.trim().toLowerCase() } : {}),
        ...(field === "cuisine" ? { cuisine: value.trim().toLowerCase() } : {}),
        ...(field === "ingredients" ? { ingredients: value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) } : {}),
        metadataSource: "user_reviewed",
      },
    }));
  }

  async function findRestaurants() {
    if (!location) { setRestaurantStatus(t("publish.noLocation")); return; }
    setRestaurantStatus("");
    try {
      const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), radiusMeters: "5000", language, dishName: analysis.name, cuisine: analysis.cuisine });
      const response = await fetch(`/api/restaurants/nearby?${query}`, { headers: authHeaders() });
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

  async function publish(metadata: PublicationMetadata) {
    if (!sessionToken || !analysisMode) { setError(t("analysis.sessionError")); setPhase("error"); return; }
    setPublishing(true);
    try {
      const response = await fetch("/api/dishes", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ analysis, sourceMode: analysisMode, imageDataUrl: pendingImage, language, ...metadata }) });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { dish: PublishedDish; matches: MatchTiers; providerStatus: { status: "live" | "unavailable" }; matchingStatus: { status: "live" | "unavailable" } };
      setMatches(payload.matches);
      setProviderUnavailable(payload.providerStatus.status === "unavailable");
      setRecordsUnavailable(payload.matchingStatus.status === "unavailable");
      setPhase("published");
      track("dish_published", { mode: analysisMode, outcome: "success" });
      const count = payload.matches.confirmedNearbyDishes.length + payload.matches.communityOrInferredDishes.length + payload.matches.restaurantLevelAlternatives.length;
      flash(t("analysis.publishedBody", { count }));
    } catch {
      setError(t("analysis.publishError"));
      setPhase("error");
    } finally { setPublishing(false); }
  }

  const validPrice = priceKnowledge === "unknown" || ((priceKnowledge === "exact" || priceKnowledge === "approximate") && Number(priceAmount) > 0);
  const validAvailability = availabilityKnowledge === "unknown" || availabilityKnowledge === "recently_confirmed" || (availabilityKnowledge === "historical" && Boolean(lastConfirmedAt));
  const ready = Boolean(selectedRestaurant && priceKnowledge && availabilityKnowledge && validPrice && validAvailability && reviewConfirmed && restaurantConfirmed);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!authenticated) { window.location.assign("/auth/login?context=publish&next=%2Fpost"); return; }
    if (!ready || !selectedRestaurant || !priceKnowledge || !availabilityKnowledge) { setRestaurantStatus(t("publish.requirements")); return; }
    void publish({
      restaurant: selectedRestaurant,
      knowledge: { priceKnowledge, priceAmount: priceKnowledge === "unknown" ? undefined : Number(priceAmount), availabilityKnowledge, lastConfirmedAt: availabilityKnowledge === "historical" ? lastConfirmedAt : undefined },
      retainImage, reviewConfirmed: true, restaurantConfirmed: true,
      tasteNotes: tasteNotes.trim() || undefined, dietaryNotes: dietaryNotes.trim() || undefined, personalComments: personalComments.trim() || undefined,
    });
  }

  if (phase === "capture") return <section className="composer composer-capture">
    <div className="composer-intro">
      <div className="eyebrow"><Icon name="camera" size={16} /> {t("nav.postDish")}</div>
      <h1>{t("home.title")}</h1>
      <p>{t("home.body")}</p>
    </div>
    <div className="composer-actions">
      <button className="primary" onClick={() => fileRef.current?.click()}><Icon name="post" size={18} /> {t("home.analyze")}</button>
      <button className="text-button" onClick={() => { setPreview(demoAnalysisImage); void analyze(undefined, true); }}>{t("home.demo")}</button>
      <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={handleFile} aria-label={t("home.analyze")} />
    </div>
  </section>;

  return <section className="composer">
    <div className="composer-image" style={{ backgroundImage: `url(${preview})` }}><span><Icon name="sparkle" size={14} /> {t("analysis.live")}</span></div>
    <div className="composer-content">
      {phase === "loading" ? <div className="loading-state" role="status" aria-live="polite">
        <div className="scan" aria-hidden="true"><span /></div>
        <em>{t("analysis.loadingKicker")}</em>
        <h1>{t("analysis.loadingTitle")}</h1>
        <div><span>{t("analysis.field.name")}</span><span>{t("analysis.field.ingredients")}</span><span>{t("analysis.field.dietary")}</span></div>
      </div>
      : phase === "error" ? <div className="identifier-error" role="alert">
        <Icon name="alert" size={24} />
        <p className="kicker">{t("analysis.unavailableKicker")}</p>
        <h1>{t("analysis.unavailableTitle")}</h1>
        <p>{error}</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => void analyze(undefined, true)}>{t("analysis.useDemo")}</button>
          <button type="button" className="primary" onClick={() => void analyze(pendingImage, false)}>{t("analysis.retry")}</button>
        </div>
      </div>
      : phase === "published" ? <div className="published">
        <Icon name="check" size={24} />
        <h1>{t("analysis.publishedTitle")}</h1>
        <p>{t("analysis.publishedBody", { count: matches.confirmedNearbyDishes.length + matches.communityOrInferredDishes.length + matches.restaurantLevelAlternatives.length })}</p>
        {recordsUnavailable && <p className="publication-status">{t("match.recordsUnavailable")}</p>}
        {providerUnavailable && <p className="publication-status">{t("match.providerUnavailable")}</p>}
        <MatchTier title={t("match.confirmedTier")} results={matches.confirmedNearbyDishes} onFeedback={(...args) => void reportFeedback(...args)} />
        <MatchTier title={t("match.communityTier")} results={matches.communityOrInferredDishes} onFeedback={(...args) => void reportFeedback(...args)} />
        <MatchTier title={t("match.restaurantTier")} results={matches.restaurantLevelAlternatives} onFeedback={(...args) => void reportFeedback(...args)} />
        <div className="modal-actions"><Link className="primary" href="/" onClick={() => track("match_opened", { mode: analysisMode ?? undefined })}>{t("analysis.explore")}</Link></div>
      </div>
      : <form onSubmit={submit}>
        <div className={`analysis-mode ${analysisMode ?? ""}`}>{analysisMode === "live" ? t("analysis.live") : t("analysis.demo")}</div>
        <span className="kicker">{t("analysis.review")}</span>
        <div className="confidence"><h1>{t("analysis.reviewTitle")}</h1><span>{t("analysis.confident", { confidence: analysis.confidence })}</span></div>
        {warning && <p className="demo-warning">{warning}</p>}
        <p className="review-note">{t("analysis.warning")}</p>
        <button type="button" className="text-button" onClick={() => void reportFeedback("wrong_identification", "analysis")}>{t("feedback.wrongIdentification")}</button>
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
        <section className="publication-section">
          <h2>{t("publish.restaurantTitle")}</h2>
          <p>{t("publish.restaurantHelp")}</p>
          <button type="button" className="secondary" onClick={() => void findRestaurants()}>{t("publish.findRestaurants")}</button>
          <p className="restaurant-search-note">{t("publish.dishSearchNotice")}</p>
          {restaurants.length > 0 && <div className="restaurant-results">
            {restaurants.map((place) => <button type="button" key={place.providerPlaceId} onClick={() => selectProviderRestaurant(place)} className={selectedRestaurant?.providerPlaceId === place.providerPlaceId ? "selected" : ""}>
              <b>{place.displayName}{place.rating != null && <span className="place-rating">{t("restaurant.rating", { rating: place.rating.toFixed(1) })}</span>}</b>
              <small>{place.address}</small>
            </button>)}
            <small className="google-attribution" translate="no">{t("publish.googleAttribution")}</small>
          </div>}
          {restaurantStatus && <p className="publication-status" role="alert">{restaurantStatus}</p>}
          <div className="manual-restaurant">
            <b>{t("publish.manualRestaurant")}</b>
            <input aria-label={t("publish.restaurantName")} placeholder={t("publish.restaurantName")} value={manualName} onChange={(event) => setManualName(event.target.value)} />
            <input aria-label={t("publish.restaurantAddress")} placeholder={t("publish.restaurantAddress")} value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} />
            <button type="button" className="secondary" onClick={useManualRestaurant}>{t("publish.selectRestaurant")}</button>
          </div>
          {selectedRestaurant && <p className="selected-restaurant"><Icon name="check" size={14} /> {t("publish.selectedRestaurant", { restaurant: selectedRestaurant.name })}</p>}
        </section>
        <section className="publication-section">
          <h2>{t("publish.knowledgeTitle")}</h2>
          <div className="knowledge-grid">
            <label>{t("publish.priceKnowledge")}<select value={priceKnowledge} onChange={(event) => setPriceKnowledge(event.target.value as typeof priceKnowledge)}><option value="">–</option><option value="unknown">{t("publish.priceUnknown")}</option><option value="exact">{t("publish.priceExact")}</option><option value="approximate">{t("publish.priceApproximate")}</option></select></label>
            {(priceKnowledge === "exact" || priceKnowledge === "approximate") && <label>{t("publish.priceAmount", { currency: location?.currencyCode ?? selectedRestaurant?.currencyCode ?? "" })}<input type="number" min="0.01" step="0.01" value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} /></label>}
            <label>{t("publish.availabilityKnowledge")}<select value={availabilityKnowledge} onChange={(event) => setAvailabilityKnowledge(event.target.value as typeof availabilityKnowledge)}><option value="">–</option><option value="unknown">{t("publish.availabilityUnknown")}</option><option value="recently_confirmed">{t("publish.availabilityRecent")}</option><option value="historical">{t("publish.availabilityHistorical")}</option></select></label>
            {availabilityKnowledge === "historical" && <label>{t("publish.lastSeen")}<input type="date" max={new Date().toISOString().slice(0, 10)} value={lastConfirmedAt} onChange={(event) => setLastConfirmedAt(event.target.value)} /></label>}
          </div>
          <p className="provenance-preview">{t("publish.provenancePreview", { provenance: t(analysisMode === "demo" ? "provenance.seed_demo" : "provenance.ai_identified"), verification: t("verification.unverified"), availability: t(availabilityKnowledge === "recently_confirmed" ? "availability.confirmed" : "availability.unknown") })}</p>
          <label className="confirmation"><input type="checkbox" checked={retainImage} onChange={(event) => setRetainImage(event.target.checked)} />{t("publish.retainImage")}</label>
          <p className="privacy-note">{t("privacy.imageRetentionDetails")}</p>
          <label className="confirmation"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />{t("publish.reviewConfirm")}</label>
          <label className="confirmation"><input type="checkbox" checked={restaurantConfirmed} onChange={(event) => setRestaurantConfirmed(event.target.checked)} disabled={!selectedRestaurant} />{t("publish.restaurantConfirm")}</label>
        </section>
        <div className="modal-actions">
          <Link className="secondary" href="/">{t("analysis.keepPrivate")}</Link>
          <button className="primary" type="submit" disabled={publishing || !ready}>{publishing ? t("analysis.publishing") : t("analysis.publish")}</button>
        </div>
      </form>}
    </div>
  </section>;
}
