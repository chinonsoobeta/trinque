export const DIETARY_REQUIREMENTS = ["vegan", "vegetarian", "celiac", "gluten_free", "dairy_free", "nut_free", "shellfish_free", "halal", "kosher"] as const;
export type DietaryRequirement = (typeof DIETARY_REQUIREMENTS)[number];

export const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  celiac: "Celiac",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_free: "Nut-free",
  shellfish_free: "Shellfish-free",
  halal: "Halal",
  kosher: "Kosher",
};

export type Tier = "fits" | "needs_checking" | "does_not_fit";

export type GroupConstraints = { budgetMax: number; maxDistanceKm: number; allergies: string[]; dietaryRequirements: DietaryRequirement[]; cuisineTypes: string[] };

export type GroupCandidateSource = { candidateId: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; priceAmount: number | null; currencyCode: string; image?: string | null; dietaryCaveat: string; cuisine?: string | null; kind: "published_dish" | "provider_restaurant"; restaurantId?: string | null; providerPlaceId?: string | null; provenance: string; verificationStatus: string; currentAvailabilityConfirmed: boolean };

export type RankedGroupCandidate = GroupCandidateSource & { price: string; image: string; score: number; eligible: boolean; tier: Tier; explanation: string; reasons: string[] };

const REASON_TRANSLATIONS: Record<string, (locale?: string) => string> = {
  over_budget: () => "Over budget",
  beyond_distance: () => "Too far",
  price_unknown: () => "Price not known",
  vegetarian_unknown: () => "Cannot confirm vegetarian",
  vegetarian_unsupported: () => "Does not support vegetarian",
  allergen_unknown: (_, detail) => `Cannot confirm ${detail ?? "allergen"}`,
  allergen_conflict: (_, detail) => `Contains ${detail ?? "allergen"}`,
  cuisine_unknown_or_mismatch: () => "Cuisine type does not match",
};

function supportsRequirement(note: string, requirement: DietaryRequirement): boolean {
  const normalized = note.toLocaleLowerCase();
  const terms: Record<DietaryRequirement, RegExp> = {
    vegan: /\bvegan\b|\bplant[- ]based\b|\bvegano\b|\bvégane?\b/,
    vegetarian: /\bvegetarian\b|\bplant[- ]based\b|\bvegetariano\b|\bvégétarien\b/,
    celiac: /\bceliac\b|\bcœliaque\b|\bcelíac/,
    gluten_free: /\bgluten[- ]free\b|\bsans gluten\b|\bsin gluten\b/,
    dairy_free: /\bdairy[- ]free\b|\bmilk[- ]free\b|\bsans lait\b|\bsin lácteos\b/,
    nut_free: /\bnut[- ]free\b|\bpeanut[- ]free\b|\bsans fruits à coque\b|\bsin frutos secos\b/,
    shellfish_free: /\bshellfish[- ]free\b|\bsans crustacés\b|\bsin mariscos\b/,
    halal: /\bhalal\b/,
    kosher: /\bkosher\b|\bcasher\b/,
  };
  return terms[requirement].test(normalized);
}

function humanReason(code: string, locale?: string): string {
  const colonIndex = code.indexOf(":");
  const key = colonIndex >= 0 ? code.slice(0, colonIndex) : code;
  const detail = colonIndex >= 0 ? code.slice(colonIndex + 1) : undefined;
  const translate = REASON_TRANSLATIONS[key];
  if (translate) return translate(locale, detail);
  const reqMatch = key.match(/^(.+)_unknown$/);
  if (reqMatch) {
    const label = DIETARY_LABELS[reqMatch[1] as keyof typeof DIETARY_LABELS];
    return label ? `Cannot confirm ${label}` : "Cannot confirm dietary";
  }
  return "Does not fit the plan";
}

export function rankGroupCandidates(candidates: GroupCandidateSource[], constraints: GroupConstraints, locale = "en-CA"): RankedGroupCandidate[] {
  return candidates.map((candidate) => {
    const searchable = `${candidate.name} ${candidate.dietaryCaveat}`.toLowerCase();
    const codes: string[] = [];
    if (candidate.priceAmount == null) codes.push("price_unknown");
    else if (candidate.priceAmount > constraints.budgetMax) codes.push("over_budget");
    if (candidate.distanceKm > constraints.maxDistanceKm) codes.push("beyond_distance");
    for (const requirement of constraints.dietaryRequirements) {
      if (!supportsRequirement(candidate.dietaryCaveat, requirement)) codes.push(`${requirement}_unknown`);
    }
    for (const allergy of constraints.allergies.map((item) => item.trim().toLowerCase()).filter(Boolean)) {
      if (candidate.kind === "provider_restaurant") codes.push(`allergen_unknown:${allergy}`);
      else if (searchable.includes(allergy)) codes.push(`allergen_conflict:${allergy}`);
    }
    if (constraints.cuisineTypes.length > 0 && (!candidate.cuisine || !constraints.cuisineTypes.some((cuisine) => candidate.cuisine?.toLocaleLowerCase().includes(cuisine.toLocaleLowerCase())))) codes.push("cuisine_unknown_or_mismatch");
    const hard = codes.filter((code) => !code.startsWith("price_unknown"));
    const eligible = hard.length === 0;
    const price = candidate.priceAmount == null ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency: candidate.currencyCode }).format(candidate.priceAmount);
    if (!eligible) return { ...candidate, price, image: candidate.image ?? "", score: 0, eligible: false, tier: "does_not_fit" as const, explanation: "Does not fit the plan", reasons: hard.map((code) => humanReason(code, locale)) };
    const needsCheck = codes.some((code) => code === "price_unknown" || code.endsWith("_unknown"));
    const explanation = needsCheck ? "Needs checking" : "Fits the plan";
    const tier = needsCheck ? "needs_checking" as const : "fits" as const;
    const budgetFit = candidate.priceAmount == null ? 0 : Math.max(0, 1 - candidate.priceAmount / Math.max(1, constraints.budgetMax * 1.5));
    const distanceFit = Math.max(0, 1 - candidate.distanceKm / Math.max(1, constraints.maxDistanceKm * 1.5));
    const recordQuality = candidate.verificationStatus === "restaurant_verified" ? 1 : candidate.verificationStatus === "community_confirmed" ? 0.75 : 0.3;
    const score = Math.round(Math.max(20, Math.min(98, 48 + budgetFit * 15 + distanceFit * 18 + recordQuality * 12 + Number(candidate.currentAvailabilityConfirmed) * 5 - codes.length * 16)));
    return { ...candidate, price, image: candidate.image ?? "", score, eligible: true, tier, explanation, reasons: codes.map((code) => humanReason(code, locale)) };
  }).sort((a, b) => {
    const tierOrder = { fits: 0, needs_checking: 1, does_not_fit: 2 };
    return tierOrder[a.tier] - tierOrder[b.tier] || b.score - a.score || a.distanceKm - b.distanceKm;
  });
}

export function selectGroupWinner(candidates: RankedGroupCandidate[], votes: Record<string, number>): RankedGroupCandidate | null {
  return [...candidates].filter((candidate) => candidate.tier !== "does_not_fit").sort((a, b) => (votes[b.candidateId] ?? 0) - (votes[a.candidateId] ?? 0) || b.score - a.score || a.distanceKm - b.distanceKm)[0] ?? null;
}

export function instantForLocalTime(localDate: string, localTime: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^\d{2}:\d{2}$/.test(localTime)) throw new Error("invalid_local_event_time");
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) throw new Error("invalid_local_event_time");
  let instant = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const rendered = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
    const requested = Date.UTC(year, month - 1, day, hour, minute);
    const adjustment = requested - rendered;
    instant += adjustment;
    if (adjustment === 0) break;
  }
  const result = new Date(instant);
  const roundTrip = formatter.formatToParts(result);
  const value = (type: string) => Number(roundTrip.find((part) => part.type === type)?.value ?? 0);
  if (value("year") !== year || value("month") !== month || value("day") !== day || value("hour") !== hour || value("minute") !== minute) throw new Error("invalid_local_event_time");
  return result;
}

export function calendarDocument({ name, eventTime, timeZone, restaurant, neighborhood, description }: { name: string; eventTime: string; timeZone: string; restaurant: string; neighborhood: string; description: string }): string {
  const start = new Date(eventTime);
  if (!Number.isFinite(start.getTime())) throw new Error("invalid_event_time");
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const localStamp = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${value("year")}${value("month")}${value("day")}T${value("hour")}${value("minute")}${value("second")}`;
  };
  const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) => value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trinque//Group Plan//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@trinque`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART;TZID=${escape(timeZone)}:${localStamp(start)}`, `DTEND;TZID=${escape(timeZone)}:${localStamp(end)}`, `SUMMARY:${escape(name)}`, `LOCATION:${escape(`${restaurant}, ${neighborhood}`)}`, `DESCRIPTION:${escape(description)}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}
