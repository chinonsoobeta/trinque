import assert from "node:assert/strict";
import test from "node:test";
import { calendarDocument, instantForLocalTime, rankGroupCandidates, selectGroupWinner } from "../lib/group-planning.ts";

const sources = [
  { candidateId: "pasta", name: "Sage pasta", restaurant: "Pasta Room", neighborhood: "London", distanceKm: 1.2, priceAmount: 22, currencyCode: "GBP", dietaryCaveat: "Vegetarian · contains dairy and gluten", kind: "published_dish", provenance: "community_submitted", verificationStatus: "community_confirmed", currentAvailabilityConfirmed: true },
  { candidateId: "sesame", name: "Sesame cauliflower", restaurant: "Garden", neighborhood: "London", distanceKm: 0.8, priceAmount: 18, currencyCode: "GBP", dietaryCaveat: "Plant-based · contains sesame", kind: "published_dish", provenance: "ai_identified", verificationStatus: "unverified", currentAvailabilityConfirmed: false },
  { candidateId: "restaurant", name: "Restaurant-level alternative", restaurant: "Nearby Place", neighborhood: "London", distanceKm: 0.4, priceAmount: null, currencyCode: "GBP", dietaryCaveat: "No dish or dietary information confirmed", kind: "provider_restaurant", provenance: "provider_place", verificationStatus: "not_applicable", currentAvailabilityConfirmed: false },
];

test("group ranking excludes hard conflicts and provider-only unknowns", () => {
  const candidates = rankGroupCandidates(sources, { budgetMax: 25, maxDistanceKm: 4, vegetarianRequired: 1, allergies: ["sesame"] }, "en-GB");
  assert.equal(candidates[0].candidateId, "pasta");
  assert.equal(candidates.find((candidate) => candidate.candidateId === "sesame").eligible, false);
  assert.deepEqual(candidates.find((candidate) => candidate.candidateId === "restaurant").conflicts, ["price_unknown", "vegetarian_unknown", "allergen_unknown:sesame"]);
});

test("votes win among eligible candidates and score breaks ties", () => {
  const second = { ...sources[0], candidateId: "pasta-2", distanceKm: 2 };
  const candidates = rankGroupCandidates([sources[0], second], { budgetMax: 35, maxDistanceKm: 4, vegetarianRequired: 1, allergies: [] });
  assert.equal(selectGroupWinner(candidates, { "pasta-2": 3, pasta: 1 }).candidateId, "pasta-2");
  assert.equal(selectGroupWinner(candidates, {}).candidateId, "pasta");
});

test("calendar export uses the group location time zone", () => {
  const calendar = calendarDocument({ name: "Friday supper", eventTime: "2026-07-18T18:30:00.000Z", timeZone: "Europe/London", restaurant: "Pasta Room", neighborhood: "Soho", description: "A strong group fit" });
  assert.match(calendar, /DTSTART;TZID=Europe\/London:20260718T193000/);
  assert.match(calendar, /LOCATION:Pasta Room\\, Soho/);
});

test("group wall time is converted using the selected location rather than the device zone", () => {
  assert.equal(instantForLocalTime("2026-07-18", "19:30", "Europe/London").toISOString(), "2026-07-18T18:30:00.000Z");
  assert.equal(instantForLocalTime("2026-07-18", "19:30", "America/Mexico_City").toISOString(), "2026-07-19T01:30:00.000Z");
});
