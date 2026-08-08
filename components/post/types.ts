import type { NormalizedLocation } from "@/lib/location";

export type Analysis = {
  name: string; cuisine: string; ingredients: string; dietary: string;
  confidence: number; description: string;
  canonical: { dishName: string; cuisine: string; ingredients: string[]; flavours: string[]; metadataSource: "ai_normalized" | "user_reviewed" };
};

export type AnalysisEnvelope =
  | { ok: true; mode: "live" | "demo"; requestId: string; result: Analysis; warning?: string }
  | { ok: false; mode: "unavailable"; requestId: string; error: { code: string; message: string }; demoAvailable: true };

export type MatchResult = {
  kind: "dish" | "restaurant_alternative"; id: string; dishName: string | null; restaurantName: string;
  locality: string; distanceKm: number; score: number;
  reasonCode: "semantic_and_distance" | "nearby_alternative" | "restaurant_only";
  provenance: string; verificationStatus: string; lastConfirmedAt: string | null;
  dietaryCaveat: string; currentAvailabilityConfirmed: boolean;
  priceAmount: number | null; currencyCode: string | null; imageUrl: string | null;
  attribution?: "Google Maps";
};

export type MatchTiers = { confirmedNearbyDishes: MatchResult[]; communityOrInferredDishes: MatchResult[]; restaurantLevelAlternatives: MatchResult[] };

export const emptyMatchTiers: MatchTiers = { confirmedNearbyDishes: [], communityOrInferredDishes: [], restaurantLevelAlternatives: [] };

export type PublishRestaurant = {
  provider: "google" | "community"; providerPlaceId?: string | null; name: string;
  latitude: number; longitude: number; locality: string; administrativeRegion: string;
  countryCode: NormalizedLocation["countryCode"]; address: string; currencyCode: string;
};

export type PublicationMetadata = {
  restaurant: PublishRestaurant;
  knowledge: { priceKnowledge: "unknown" | "exact" | "approximate"; priceAmount?: number; availabilityKnowledge: "unknown" | "recently_confirmed" | "historical"; lastConfirmedAt?: string };
  retainImage: boolean; reviewConfirmed: true; restaurantConfirmed: true;
  tasteNotes?: string; dietaryNotes?: string; personalComments?: string;
};

export type PublishedDish = Analysis & {
  id: string; sourceMode: "live" | "demo"; imageUrl?: string | null; localPreview?: string;
  provenance?: string; verificationStatus?: string; availabilityKnowledge?: string;
  contributorLabel?: string; isOwner?: boolean; ownerId?: string; isSaved?: boolean;
  restaurant?: { name: string } | null; caption?: string;
  tasteNotes?: string; dietaryNotes?: string; personalComments?: string;
  locationTag?: string; moderationStatus?: string;
};

export type FeedbackReason = "wrong_identification" | "stale_dish" | "closed_restaurant";

/**
 * The fixture the labelled demo starts from. It is only ever shown behind an
 * explicit "demo" badge — Trinque does not present it as a real identification.
 */
export const demoAnalysis: Analysis = {
  name: "Brown butter agnolotti", cuisine: "Northern Italian",
  ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
  dietary: "Vegetarian · Contains dairy and gluten", confidence: 94,
  description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
  canonical: { dishName: "agnolotti", cuisine: "northern italian", ingredients: ["filled pasta", "butter", "sage", "lemon", "parmesan"], flavours: ["nutty", "herbal", "bright"], metadataSource: "user_reviewed" },
};

export const demoAnalysisImage = "/images/demo-pasta.jpg";
