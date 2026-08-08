"use client";

import { MediaImage } from "@/components/MediaImage";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import { usePreferences } from "@/components/PreferencesProvider";
import type { FeedbackReason, MatchResult } from "@/components/post/types";
import type { MessageKey } from "@/ios/i18n";

/**
 * One band of nearby matches. Every result carries where it came from and how
 * recently anyone confirmed it — a match Trinque cannot vouch for says so.
 */
export function MatchTier({ title, results, onFeedback }: {
  title: string;
  results: MatchResult[];
  onFeedback: (reason: FeedbackReason, targetType: "analysis" | "published_dish" | "restaurant", targetId?: string | null) => void;
}) {
  const t = useUiText();
  const language = useUiLanguage();
  const { measurementSystem } = usePreferences();

  return <section className="match-tier">
    <h3>{title}</h3>
    {results.length === 0 ? <p className="empty-tier">{t("match.noResults")}</p> : <div className="nearby-results">{results.slice(0, 4).map((match) => {
      const distance = new Intl.NumberFormat(language, { style: "unit", unit: measurementSystem === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(measurementSystem === "imperial" ? match.distanceKm * .621371 : match.distanceKm);
      const provenance = match.provenance === "provider_place" ? t("match.providerPlace") : t(`provenance.${match.provenance}` as MessageKey);
      const verification = match.verificationStatus === "not_applicable" ? t("match.notApplicable") : t(`verification.${match.verificationStatus}` as MessageKey);
      const reason = t(match.reasonCode === "restaurant_only" ? "match.restaurantReason" : match.reasonCode === "semantic_and_distance" ? "match.semanticReason" : "match.nearbyReason");
      const price = match.priceAmount != null && match.currencyCode ? new Intl.NumberFormat(language, { style: "currency", currency: match.currencyCode }).format(match.priceAmount) : null;
      return <article key={match.id}>
        {match.imageUrl ? <MediaImage src={match.imageUrl} alt="" width={640} height={480} sizes="(max-width: 768px) 100vw, 320px" /> : <div className="match-placeholder" aria-hidden="true">T</div>}
        <div>
          <b>{match.dishName ?? match.restaurantName}</b>
          <small>{match.dishName ? `${match.restaurantName} · ` : ""}{distance} · {match.score}%{price ? ` · ${price}` : ""}</small>
          <p>{reason}</p>
          <small>{provenance} · {verification}</small>
          <small>{match.lastConfirmedAt ? t("match.lastConfirmed", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(match.lastConfirmedAt)) }) : t("match.neverConfirmed")}</small>
          <small>{match.currentAvailabilityConfirmed ? t("availability.confirmed") : t("availability.unknown")}</small>
          <p className="dietary-caveat">{match.dietaryCaveat === "provider_information_unconfirmed" ? t("group.providerCaveat") : t("analysis.warning")}</p>
          {match.attribution && <small translate="no">Google Maps</small>}
          <button className="text-button" onClick={() => onFeedback(match.kind === "dish" ? "stale_dish" : "closed_restaurant", match.kind === "dish" ? "published_dish" : "restaurant", match.id)}>{t(match.kind === "dish" ? "feedback.staleDish" : "feedback.closedRestaurant")}</button>
        </div>
      </article>;
    })}</div>}
  </section>;
}
