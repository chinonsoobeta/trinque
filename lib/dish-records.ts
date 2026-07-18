import type { DishAnalysis } from "./dish-analysis.ts";
import { REGIONAL_DEFAULTS, isSupportedCountry, type SupportedCountry, type SupportedLanguage } from "./regions.ts";

export const DISH_PROVENANCE = ["ai_identified", "community_submitted", "restaurant_verified", "menu_imported", "seed_demo"] as const;
export const VERIFICATION_STATES = ["unverified", "community_confirmed", "restaurant_verified", "stale", "disputed"] as const;
export const PRICE_KNOWLEDGE = ["unknown", "exact", "approximate"] as const;
export const AVAILABILITY_KNOWLEDGE = ["unknown", "recently_confirmed", "historical"] as const;

export type DishProvenance = (typeof DISH_PROVENANCE)[number];
export type VerificationStatus = (typeof VERIFICATION_STATES)[number];
export type PriceKnowledge = (typeof PRICE_KNOWLEDGE)[number];
export type AvailabilityKnowledge = (typeof AVAILABILITY_KNOWLEDGE)[number];

export type PublishRestaurantInput = {
  provider: "google" | "community";
  providerPlaceId?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  locality: string;
  administrativeRegion: string;
  countryCode: SupportedCountry;
  address: string;
  currencyCode: string;
};

export type PublicationKnowledge = {
  priceKnowledge: PriceKnowledge;
  priceAmount?: number | null;
  availabilityKnowledge: AvailabilityKnowledge;
  lastConfirmedAt?: string | null;
};

export function normalizePublicationRestaurant(input: PublishRestaurantInput) {
  if (!isSupportedCountry(input.countryCode)) throw new Error("unsupported_country");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error("invalid_restaurant_coordinates");
  const name = requiredText(input.name, "restaurant_name", 160);
  const locality = requiredText(input.locality, "restaurant_locality", 120);
  const administrativeRegion = requiredText(input.administrativeRegion, "restaurant_region", 120);
  const address = requiredText(input.address, "restaurant_address", 300);
  const expectedCurrency = REGIONAL_DEFAULTS[input.countryCode].currencyCode;
  if (input.currencyCode.toUpperCase() !== expectedCurrency) throw new Error("invalid_restaurant_currency");
  const providerPlaceId = input.providerPlaceId?.replace(/^places\//, "").trim() || null;
  if (input.provider === "google" && (!providerPlaceId || !/^[A-Za-z0-9_-]{4,256}$/.test(providerPlaceId))) throw new Error("provider_place_required");
  if (input.provider === "community" && providerPlaceId) throw new Error("community_place_id_not_allowed");
  return {
    provider: input.provider,
    providerPlaceId,
    name,
    latitude: input.latitude,
    longitude: input.longitude,
    locality,
    administrativeRegion,
    countryCode: input.countryCode,
    address,
    currencyCode: expectedCurrency,
    recordSource: "community_submitted" as const,
    providerUpdatedAt: null,
  };
}

export function preparePublishedDish({
  analysis,
  sourceMode,
  knowledge,
  language,
  restaurant,
  now = new Date(),
}: {
  analysis: DishAnalysis;
  sourceMode: "live" | "demo";
  knowledge: PublicationKnowledge;
  language: SupportedLanguage;
  restaurant: ReturnType<typeof normalizePublicationRestaurant>;
  now?: Date;
}) {
  if (!PRICE_KNOWLEDGE.includes(knowledge.priceKnowledge)) throw new Error("price_knowledge_required");
  if (!AVAILABILITY_KNOWLEDGE.includes(knowledge.availabilityKnowledge)) throw new Error("availability_knowledge_required");
  const priceAmount = knowledge.priceKnowledge === "unknown" ? null : knowledge.priceAmount;
  if (knowledge.priceKnowledge !== "unknown" && (!Number.isFinite(priceAmount) || (priceAmount as number) <= 0 || (priceAmount as number) > 100_000)) throw new Error("valid_price_required");
  let lastConfirmedAt: string | null = null;
  let availabilityConfidence = 0;
  if (knowledge.availabilityKnowledge === "recently_confirmed") {
    lastConfirmedAt = now.toISOString();
    availabilityConfidence = 90;
  } else if (knowledge.availabilityKnowledge === "historical") {
    const confirmed = knowledge.lastConfirmedAt ? new Date(knowledge.lastConfirmedAt) : null;
    if (!confirmed || !Number.isFinite(confirmed.getTime()) || confirmed > now) throw new Error("historical_date_required");
    lastConfirmedAt = confirmed.toISOString();
    availabilityConfidence = 40;
  }
  return {
    priceKnowledge: knowledge.priceKnowledge,
    priceAmount: priceAmount == null ? null : Math.round((priceAmount as number) * 100) / 100,
    currencyCode: restaurant.currencyCode,
    provenance: (sourceMode === "demo" ? "seed_demo" : "ai_identified") as DishProvenance,
    verificationStatus: "unverified" as VerificationStatus,
    availabilityKnowledge: knowledge.availabilityKnowledge,
    availabilityConfidence,
    lastConfirmedAt,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    countryCode: restaurant.countryCode,
    language,
    originalName: analysis.name.trim(),
    canonicalCuisine: analysis.canonical.cuisine,
    canonicalIngredients: JSON.stringify(analysis.canonical.ingredients),
    canonicalFlavours: JSON.stringify(analysis.canonical.flavours),
    canonicalMetadataSource: analysis.canonical.metadataSource,
  };
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(field);
  return normalized;
}
