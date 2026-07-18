import type { DishAnalysis } from "./dish-analysis.ts";
import type { DishProvenance, VerificationStatus } from "./dish-records.ts";
import type { RestaurantPlace } from "./places/types.ts";
import { isSupportedCountry, type SupportedCountry } from "./regions.ts";

export type MatchLocation = { latitude: number; longitude: number; countryCode: SupportedCountry };

export type PublishedDishCandidate = {
  id: string;
  name: string;
  originalName?: string | null;
  cuisine: string;
  ingredients: string;
  dietary: string;
  description: string;
  canonicalCuisine?: string | null;
  canonicalIngredients?: string[] | null;
  canonicalFlavours?: string[] | null;
  provenance: DishProvenance;
  verificationStatus: VerificationStatus;
  availabilityKnowledge: "unknown" | "recently_confirmed" | "historical";
  lastConfirmedAt?: string | null;
  createdAt: string;
  latitude: number;
  longitude: number;
  countryCode: SupportedCountry;
  priceAmount?: number | null;
  currencyCode?: string | null;
  imageUrl?: string | null;
  communityConfirmationCount?: number;
  restaurant: { id: string; name: string; locality: string; address: string };
};

export type DishMatch = {
  kind: "dish";
  tier: "confirmed" | "community";
  id: string;
  dishName: string;
  restaurantName: string;
  locality: string;
  distanceKm: number;
  score: number;
  whyMatch: string;
  reasonCode: "semantic_and_distance" | "nearby_alternative";
  provenance: DishProvenance;
  verificationStatus: VerificationStatus;
  lastConfirmedAt: string | null;
  dietaryCaveat: string;
  currentAvailabilityConfirmed: boolean;
  priceAmount: number | null;
  currencyCode: string | null;
  imageUrl: string | null;
};

export type RestaurantAlternativeMatch = {
  kind: "restaurant_alternative";
  tier: "restaurant";
  id: string;
  providerPlaceId: string;
  dishName: null;
  restaurantName: string;
  locality: string;
  distanceKm: number;
  score: number;
  whyMatch: string;
  reasonCode: "restaurant_only";
  provenance: "provider_place";
  verificationStatus: "not_applicable";
  lastConfirmedAt: null;
  dietaryCaveat: string;
  currentAvailabilityConfirmed: false;
  priceAmount: null;
  currencyCode: string;
  imageUrl: null;
  googleMapsUri?: string;
  attribution: "Google Maps";
};

export type MatchTiers = {
  confirmedNearbyDishes: DishMatch[];
  communityOrInferredDishes: DishMatch[];
  restaurantLevelAlternatives: RestaurantAlternativeMatch[];
};

const provenanceQuality: Record<DishProvenance, number> = {
  restaurant_verified: 1,
  menu_imported: 0.9,
  community_submitted: 0.68,
  ai_identified: 0.42,
  seed_demo: 0,
};

const verificationQuality: Record<VerificationStatus, number> = {
  restaurant_verified: 1,
  community_confirmed: 0.82,
  unverified: 0.3,
  stale: 0.08,
  disputed: 0,
};

export function matchNearby({ analysis, location, dishes, restaurantAlternatives = [], now = new Date(), limitPerTier = 8, maxDishDistanceKm = 80 }: { analysis: DishAnalysis; location: MatchLocation; dishes: PublishedDishCandidate[]; restaurantAlternatives?: RestaurantPlace[]; now?: Date; limitPerTier?: number; maxDishDistanceKm?: number }): MatchTiers {
  validateLocation(location);
  const sourceCanonical = tokens(`${analysis.canonical.dishName} ${analysis.canonical.cuisine} ${analysis.canonical.ingredients.join(" ")} ${analysis.canonical.flavours.join(" ")}`);
  const sourceReviewed = tokens(`${analysis.name} ${analysis.cuisine} ${analysis.ingredients} ${analysis.description}`);
  const ranked = dishes.filter((dish) => dish.countryCode === location.countryCode && dish.provenance !== "seed_demo" && dish.verificationStatus !== "disputed").map((dish) => {
    const distanceKm = distanceBetween(location, dish);
    const candidateCanonical = tokens(`${dish.originalName ?? dish.name} ${dish.canonicalCuisine ?? dish.cuisine} ${(dish.canonicalIngredients ?? []).join(" ")} ${(dish.canonicalFlavours ?? []).join(" ")}`);
    const candidateReviewed = tokens(`${dish.name} ${dish.cuisine} ${dish.ingredients} ${dish.description}`);
    const canonicalFit = symmetricOverlap(sourceCanonical, candidateCanonical);
    const reviewedFit = symmetricOverlap(sourceReviewed, candidateReviewed);
    const distanceFit = Math.max(0, 1 - distanceKm / 50);
    const ageDays = ageInDays(dish.lastConfirmedAt ?? dish.createdAt, now);
    const freshness = Math.max(0, 1 - ageDays / 365);
    const confirmations = Math.min(1, (dish.communityConfirmationCount ?? 0) / 3);
    const quality = provenanceQuality[dish.provenance] * 0.55 + verificationQuality[dish.verificationStatus] * 0.45;
    const score = Math.round(100 * (canonicalFit * 0.42 + reviewedFit * 0.16 + distanceFit * 0.17 + quality * 0.16 + freshness * 0.06 + confirmations * 0.03));
    const currentAvailabilityConfirmed = dish.availabilityKnowledge === "recently_confirmed" && Boolean(dish.lastConfirmedAt) && ageInDays(dish.lastConfirmedAt!, now) <= 90;
    const tier = currentAvailabilityConfirmed && ["community_confirmed", "restaurant_verified"].includes(dish.verificationStatus) ? "confirmed" : "community";
    return {
      kind: "dish" as const,
      tier,
      id: dish.id,
      dishName: dish.originalName ?? dish.name,
      restaurantName: dish.restaurant.name,
      locality: dish.restaurant.locality,
      distanceKm,
      score,
      whyMatch: canonicalFit + reviewedFit > 0.12 ? "Similar reviewed dish concepts with distance, provenance, verification, and freshness considered." : "A nearby community dish record; similarity is limited and current availability may be unknown.",
      reasonCode: (canonicalFit + reviewedFit > 0.12 ? "semantic_and_distance" : "nearby_alternative") as DishMatch["reasonCode"],
      provenance: dish.provenance,
      verificationStatus: dish.verificationStatus,
      lastConfirmedAt: dish.lastConfirmedAt ?? null,
      dietaryCaveat: dish.dietary || "Dietary details are unknown; confirm directly with the restaurant.",
      currentAvailabilityConfirmed,
      priceAmount: dish.priceAmount ?? null,
      currencyCode: dish.currencyCode ?? null,
      imageUrl: dish.imageUrl ?? null,
    } satisfies DishMatch;
  }).filter((result) => result.distanceKm <= maxDishDistanceKm).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));

  const confirmedNearbyDishes = ranked.filter((result) => result.tier === "confirmed").slice(0, limitPerTier);
  const communityOrInferredDishes = ranked.filter((result) => result.tier === "community").slice(0, limitPerTier);
  const restaurantLevelAlternatives = restaurantAlternatives.filter((place) => place.countryCode === location.countryCode).map((place) => {
    const distanceKm = place.distanceKm ?? distanceBetween(location, place);
    const ratingFit = place.rating ? Math.min(1, place.rating / 5) : 0.5;
    return {
      kind: "restaurant_alternative" as const,
      tier: "restaurant" as const,
      id: `google:${place.providerPlaceId}`,
      providerPlaceId: place.providerPlaceId,
      dishName: null,
      restaurantName: place.displayName,
      locality: place.locality,
      distanceKm,
      score: Math.round(100 * (Math.max(0, 1 - distanceKm / 50) * 0.7 + ratingFit * 0.3)),
      whyMatch: "Nearby restaurant-level alternative only. No matching dish or current menu availability is claimed.",
      reasonCode: "restaurant_only" as const,
      provenance: "provider_place" as const,
      verificationStatus: "not_applicable" as const,
      lastConfirmedAt: null,
      dietaryCaveat: "No dish, ingredient, allergen, or dietary information is confirmed for this restaurant suggestion.",
      currentAvailabilityConfirmed: false as const,
      priceAmount: null,
      currencyCode: place.currencyCode,
      imageUrl: null,
      googleMapsUri: place.googleMapsUri,
      attribution: "Google Maps" as const,
    };
  }).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm).slice(0, limitPerTier);

  return { confirmedNearbyDishes, communityOrInferredDishes, restaurantLevelAlternatives };
}

function validateLocation(location: MatchLocation) {
  if (!isSupportedCountry(location.countryCode) || !Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90 || !Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) throw new Error("unsupported_or_invalid_location");
}

function tokens(value: string): Set<string> {
  return new Set(value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 2));
}

function symmetricOverlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / Math.sqrt(left.size * right.size);
}

function ageInDays(value: string, now: Date): number {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 3650;
  return Math.max(0, (now.getTime() - timestamp) / 86_400_000);
}

export function distanceBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLatitude = radians(b.latitude - a.latitude);
  const dLongitude = radians(b.longitude - a.longitude);
  const value = Math.sin(dLatitude / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
