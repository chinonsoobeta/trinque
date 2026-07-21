import assert from "node:assert/strict";
import test from "node:test";
import { AVAILABILITY_KNOWLEDGE, DISH_PROVENANCE, PRICE_KNOWLEDGE, VERIFICATION_STATES, normalizePublicationRestaurant, preparePublishedDish } from "../lib/dish-records.ts";
import { demoAnalysis } from "../lib/dish-analysis.ts";

const restaurantInput = {
  provider: "google",
  providerPlaceId: "ChIJRestaurant123",
  name: "Café Montréal",
  latitude: 45.5019,
  longitude: -73.5674,
  locality: "Montréal",
  administrativeRegion: "QC",
  countryCode: "CA",
  address: "10 rue Exemple, Montréal, QC",
  currencyCode: "CAD",
};

test("dish provenance and verification contracts are exhaustive", () => {
  assert.deepEqual(DISH_PROVENANCE, ["ai_identified", "community_submitted", "restaurant_verified", "menu_imported", "seed_demo"]);
  assert.deepEqual(VERIFICATION_STATES, ["unverified", "community_confirmed", "restaurant_verified", "stale", "disputed"]);
  assert.deepEqual(PRICE_KNOWLEDGE, ["unknown", "exact", "approximate"]);
  assert.deepEqual(AVAILABILITY_KNOWLEDGE, ["unknown", "recently_confirmed", "historical"]);
});

test("reviewed AI publishing is associated with a restaurant but never restaurant verified", () => {
  const restaurant = normalizePublicationRestaurant(restaurantInput);
  const record = preparePublishedDish({
    analysis: { ...demoAnalysis(), canonical: { ...demoAnalysis().canonical, metadataSource: "ai_normalized" } },
    sourceMode: "live",
    knowledge: { priceKnowledge: "exact", priceAmount: 24.5, availabilityKnowledge: "recently_confirmed" },
    language: "fr",
    restaurant,
    now: new Date("2026-07-18T12:00:00.000Z"),
  });
  assert.equal(record.provenance, "ai_identified");
  assert.equal(record.verificationStatus, "unverified");
  assert.equal(record.availabilityConfidence, 90);
  assert.equal(record.lastConfirmedAt, "2026-07-18T12:00:00.000Z");
  assert.equal(record.priceAmount, 24.5);
  assert.equal(record.currencyCode, "CAD");
  assert.equal(record.canonicalMetadataSource, "ai_normalized");
});

test("demo publishing remains seeded and unknown availability is explicit", () => {
  const record = preparePublishedDish({
    analysis: demoAnalysis(),
    sourceMode: "demo",
    knowledge: { priceKnowledge: "unknown", availabilityKnowledge: "unknown" },
    language: "en-GB",
    restaurant: normalizePublicationRestaurant(restaurantInput),
  });
  assert.equal(record.provenance, "seed_demo");
  assert.equal(record.verificationStatus, "unverified");
  assert.equal(record.availabilityConfidence, 0);
  assert.equal(record.lastConfirmedAt, null);
  assert.equal(record.priceAmount, null);
});

test("restaurant, price and historical availability validation reject unsupported claims", () => {
  assert.throws(() => normalizePublicationRestaurant({ ...restaurantInput, countryCode: "CH" }), /unsupported_country/);
  assert.throws(() => normalizePublicationRestaurant({ ...restaurantInput, currencyCode: "USD" }), /invalid_restaurant_currency/);
  assert.throws(() => normalizePublicationRestaurant({ ...restaurantInput, providerPlaceId: null }), /provider_place_required/);
  const restaurant = normalizePublicationRestaurant(restaurantInput);
  assert.throws(() => preparePublishedDish({ analysis: demoAnalysis(), sourceMode: "live", knowledge: { priceKnowledge: "exact", availabilityKnowledge: "unknown" }, language: "fr", restaurant }), /valid_price_required/);
  assert.throws(() => preparePublishedDish({ analysis: demoAnalysis(), sourceMode: "live", knowledge: { priceKnowledge: "unknown", availabilityKnowledge: "historical", lastConfirmedAt: "2050-01-01" }, language: "fr", restaurant, now: new Date("2026-07-18") }), /historical_date_required/);
});
