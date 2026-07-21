import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { matchNearby } from "../lib/dish-matching.ts";

const analysis = {
  name: "Brown butter ravioli", cuisine: "Italian", ingredients: "filled pasta, sage, butter", dietary: "Contains gluten and dairy", confidence: 91, description: "Silky, nutty and herbal",
  canonical: { dishName: "filled pasta", cuisine: "italian", ingredients: ["pasta", "butter", "sage"], flavours: ["silky", "nutty", "herbal"], metadataSource: "user_reviewed" },
};
const base = { cuisine: "Italian", ingredients: "pasta butter sage", dietary: "Contains gluten and dairy", description: "Silky and herbal", canonicalCuisine: "italian", canonicalIngredients: ["pasta", "butter", "sage"], canonicalFlavours: ["silky", "nutty"], provenance: "community_submitted", verificationStatus: "community_confirmed", availabilityKnowledge: "recently_confirmed", lastConfirmedAt: "2026-07-10T12:00:00.000Z", createdAt: "2026-07-01T12:00:00.000Z", countryCode: "GB", priceAmount: 22, currencyCode: "GBP", restaurant: { id: "r", name: "The Pasta Room", locality: "London", address: "1 Example Street" } };
const londonDish = { ...base, id: "london", name: "Sage ravioli", latitude: 51.51, longitude: -0.13 };
const edinburghDish = { ...base, id: "edinburgh", name: "Sage tortelli", latitude: 55.953, longitude: -3.188 };

test("user location changes result ordering", () => {
  const london = matchNearby({ analysis, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [edinburghDish, londonDish], now: new Date("2026-07-18") });
  const edinburgh = matchNearby({ analysis, location: { latitude: 55.95, longitude: -3.19, countryCode: "GB" }, dishes: [londonDish, edinburghDish], now: new Date("2026-07-18") });
  assert.equal(london.confirmedNearbyDishes[0].id, "london");
  assert.equal(edinburgh.confirmedNearbyDishes[0].id, "edinburgh");
});

test("reviewed concepts change ordering while display language alone does not", () => {
  const taco = { ...londonDish, id: "taco", name: "Taco de hongos", cuisine: "Mexican", ingredients: "mushroom chile lime tortilla", canonicalCuisine: "mexican", canonicalIngredients: ["mushroom", "chile", "lime", "tortilla"], canonicalFlavours: ["spicy", "bright"] };
  const edited = { ...analysis, name: "Mushroom tacos", cuisine: "Mexican", ingredients: "mushroom chile lime tortilla", description: "Spicy and bright", canonical: { ...analysis.canonical, dishName: "mushroom tacos", cuisine: "mexican", ingredients: ["mushroom", "chile", "lime", "tortilla"], flavours: ["spicy", "bright"] } };
  const changed = matchNearby({ analysis: edited, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [londonDish, taco], now: new Date("2026-07-18") });
  assert.equal(changed.confirmedNearbyDishes[0].id, "taco");
  const translated = { ...analysis, name: "Raviolis au beurre noisette", cuisine: "Italienne", ingredients: "pâtes farcies, sauge, beurre", description: "Soyeux et aux herbes" };
  const originalOrder = matchNearby({ analysis, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [taco, londonDish], now: new Date("2026-07-18") });
  const translatedOrder = matchNearby({ analysis: translated, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [taco, londonDish], now: new Date("2026-07-18") });
  assert.equal(translatedOrder.confirmedNearbyDishes[0].id, originalOrder.confirmedNearbyDishes[0].id);
});

test("stale and unverified records are down-ranked", () => {
  const stale = { ...londonDish, id: "stale", name: "Exact sage ravioli", verificationStatus: "stale", availabilityKnowledge: "historical", lastConfirmedAt: "2024-01-01T00:00:00.000Z", latitude: 51.5001, longitude: -0.1201 };
  const current = { ...londonDish, id: "current", latitude: 51.53, longitude: -0.15 };
  const result = matchNearby({ analysis, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [stale, current], now: new Date("2026-07-18") });
  assert.equal(result.confirmedNearbyDishes[0].id, "current");
  assert.equal(result.communityOrInferredDishes[0].id, "stale");
  assert.ok(result.confirmedNearbyDishes[0].score > result.communityOrInferredDishes[0].score);
});

test("unsupported-country coordinates are rejected", () => {
  assert.throws(() => matchNearby({ analysis, location: { latitude: 46.2, longitude: 6.1, countryCode: "CH" }, dishes: [] }), /unsupported_or_invalid_location/);
});

test("restaurant alternatives never claim a menu item", () => {
  const alternatives = matchNearby({ analysis, location: { latitude: 51.5, longitude: -0.12, countryCode: "GB" }, dishes: [], restaurantAlternatives: [{ provider: "google", providerPlaceId: "place123", displayName: "Nearby Kitchen", address: "2 Example Street", latitude: 51.51, longitude: -0.12, locality: "London", administrativeRegion: "England", countryCode: "GB", currencyCode: "GBP", locale: "en-GB", photos: [], providerAttributions: [], attribution: "Google Maps" }] });
  const result = alternatives.restaurantLevelAlternatives[0];
  assert.equal(result.kind, "restaurant_alternative");
  assert.equal(result.dishName, null);
  assert.equal(result.currentAvailabilityConfirmed, false);
  assert.match(result.whyMatch, /No matching dish|No.*menu.*claimed/i);
  assert.doesNotMatch(result.whyMatch, /serves/i);
});

test("the live publication route cannot reach the seeded demo catalog", async () => {
  const source = await readFile(new URL("../app/api/dishes/route.ts", import.meta.url), "utf8");
  assert.match(source, /matchNearby/);
  assert.doesNotMatch(source, /demoNearbyCatalog|rankDemoNearbyMatches|nearbyCatalog/);
  assert.match(source, /providerStatus/);
  assert.match(source, /matchingStatus/);
});
