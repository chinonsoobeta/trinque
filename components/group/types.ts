import type { MessageKey } from "@/ios/i18n";

export type GroupCandidate = {
  candidateId: string; name: string; restaurant: string; neighborhood: string; distanceKm: number;
  price: string; image: string; score: number; eligible: boolean;
  tier: "fits" | "needs_checking" | "does_not_fit";
  explanation: string; reasons: string[]; conflicts: string[];
  kind: "published_dish" | "provider_restaurant" | "seed_demo";
  provenance?: string | null; verificationStatus?: string | null;
  currentAvailabilityConfirmed: boolean; dietaryCaveat: string;
};

export type GroupSnapshot = {
  id: string; name: string; eventTime: string; eventLocalDate: string | null; eventLocalTime: string | null;
  neighborhood: string; budgetMax: number; maxDistanceKm: number; distanceUnit: "metric" | "imperial";
  allergies: string[]; dietaryRequirements: string[]; cuisineTypes: string[];
  inviteCode: string; inviteExpiresAt: string | null; inviteRevokedAt: string | null;
  status: "voting" | "finalized"; selectedCandidateId: string | null;
  candidates: GroupCandidate[]; votes: Record<string, number>; rsvps: Record<string, number>;
  memberCount: number; viewerRole: "owner" | "participant"; viewerVote: string | null; viewerRsvp: string | null;
  timeZone: string | null; currencyCode: string | null; locale: string | null;
  locality: string | null; administrativeRegion?: string | null; countryCode: string | null;
  latitude?: number | null; longitude?: number | null;
};

type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

/**
 * The planner reports why a candidate does not fit as a machine-readable code,
 * optionally with a detail after a colon (`allergen_conflict:peanut`).
 */
export function groupConflictLabel(t: Translator, reason: string): string {
  const [code, detail = ""] = reason.split(":", 2);
  const keys: Record<string, MessageKey> = {
    price_unknown: "group.conflict.priceUnknown",
    over_budget: "group.conflict.overBudget",
    beyond_distance: "group.conflict.beyondDistance",
    vegetarian_unknown: "group.conflict.vegetarianUnknown",
    vegetarian_unsupported: "group.conflict.vegetarianUnsupported",
    allergen_unknown: "group.conflict.allergenUnknown",
    allergen_conflict: "group.conflict.allergenConflict",
    cuisine_unknown_or_mismatch: "group.conflict.cuisineUnknownOrMismatch",
  };
  return keys[code] ? t(keys[code], { allergen: detail }) : reason;
}

export const DIETARY_OPTIONS = ["vegan", "vegetarian", "celiac", "gluten_free", "dairy_free", "nut_free", "shellfish_free", "halal", "kosher"] as const;
