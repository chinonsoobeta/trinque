import assert from "node:assert/strict";
import test from "node:test";
import { GooglePlacesProvider, googleLocationFieldMasks, haversineDistanceKm } from "../lib/places/google-location.ts";
import { normalizeLocation } from "../lib/location.ts";

function googleRestaurant({ id = "ChIJRestaurant123", name = "Café Étoile", countryCode = "FR", locality = "Lyon", region = "Auvergne-Rhône-Alpes", latitude = 45.764, longitude = 4.8357, timeZone = "Europe/Paris" } = {}) {
  return {
    id,
    displayName: { text: name, languageCode: countryCode === "MX" ? "es" : countryCode === "FR" ? "fr" : "en" },
    formattedAddress: `10 Main Street, ${locality}`,
    location: { latitude, longitude },
    timeZone: { id: timeZone },
    priceLevel: "PRICE_LEVEL_MODERATE",
    rating: 4.7,
    businessStatus: "OPERATIONAL",
    currentOpeningHours: { openNow: true },
    primaryType: "restaurant",
    types: ["restaurant", "food", "point_of_interest", "establishment"],
    addressComponents: [
      { longText: locality, shortText: locality, types: ["locality"] },
      { longText: region, shortText: region, types: ["administrative_area_level_1"] },
      { longText: countryCode, shortText: countryCode, types: ["country"] },
    ],
    photos: [{
      name: `places/${id}/photos/photoABC`, widthPx: 1600, heightPx: 1200,
      authorAttributions: [{ displayName: "A. Photographer", uri: "https://maps.google.com/contrib/example", photoUri: "https://example.com/avatar" }],
      googleMapsUri: "https://maps.google.com/photo/example", flagContentUri: "https://maps.google.com/photo/example/report",
    }],
    attributions: [{ provider: "Local data partner", providerUri: "https://example.com/provider" }],
    googleMapsUri: "https://maps.google.com/place/example",
  };
}

test("nearby restaurant search uses a minimal field mask and normalizes Google content", async () => {
  let captured;
  const provider = new GooglePlacesProvider("server-secret", async (url, init) => {
    captured = { url, init };
    return Response.json({ places: [googleRestaurant()] });
  });
  const location = normalizeLocation({ latitude: 45.75, longitude: 4.83, locality: "Lyon", administrativeRegion: "Auvergne-Rhône-Alpes", countryCode: "FR", timeZone: "Europe/Paris", source: "manual" }, "en-GB");
  const [restaurant] = await provider.nearbyRestaurants(location, { language: "en-GB", radiusMeters: 3_000 });
  assert.equal(captured.url, "https://places.googleapis.com/v1/places:searchNearby");
  assert.equal(captured.init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.nearbyRestaurants);
  assert.equal(captured.init.cache, "no-store");
  assert.deepEqual(JSON.parse(captured.init.body), {
    includedTypes: ["restaurant"],
    includedPrimaryTypes: ["restaurant"],
    locationRestriction: { circle: { center: { latitude: 45.75, longitude: 4.83 }, radius: 3_000 } },
    rankPreference: "POPULARITY", maxResultCount: 20, languageCode: "en-GB",
  });
  assert.equal(restaurant.displayName, "Café Étoile");
  assert.equal(restaurant.countryCode, "FR");
  assert.equal(restaurant.currencyCode, "EUR");
  assert.equal(restaurant.priceLevel, "moderate");
  assert.equal(restaurant.rating, 4.7);
  assert.equal(restaurant.openingStatus, "open");
  assert.equal(restaurant.businessStatus, "operational");
  assert.ok(restaurant.distanceKm > 1 && restaurant.distanceKm < 2);
  assert.equal(restaurant.photos[0].authorAttributions[0].displayName, "A. Photographer");
  assert.equal(restaurant.photos[0].googleMapsUri, "https://maps.google.com/photo/example");
  assert.deepEqual(restaurant.providerAttributions, [{ provider: "Local data partner", providerUri: "https://example.com/provider" }]);
});

test("nearby restaurant search excludes a cinema carrying a food-service tag", async () => {
  const provider = new GooglePlacesProvider("server-secret", async () => Response.json({
    places: [
      { ...googleRestaurant({ id: "ChIJCinema123", name: "Cinema with concessions" }), primaryType: "movie_theater", types: ["movie_theater", "restaurant", "food"] },
      googleRestaurant({ id: "ChIJRealRestaurant123", name: "Verified restaurant category" }),
    ],
  }));
  const location = normalizeLocation({ latitude: 48.8566, longitude: 2.3522, locality: "Paris", administrativeRegion: "IDF", countryCode: "FR", timeZone: "Europe/Paris", source: "manual" }, "fr");
  const restaurants = await provider.nearbyRestaurants(location, { language: "fr", radiusMeters: 3_000 });
  assert.deepEqual(restaurants.map((restaurant) => restaurant.displayName), ["Verified restaurant category"]);
});

test("reviewed dish restaurant search uses Google Text Search without claiming menu availability", async () => {
  let captured;
  const provider = new GooglePlacesProvider("server-secret", async (url, init) => {
    captured = { url, init };
    return Response.json({ places: [googleRestaurant({ name: "La Maison des Crêpes" })] });
  });
  const location = normalizeLocation({ latitude: 48.8566, longitude: 2.3522, locality: "Paris", administrativeRegion: "Île-de-France", countryCode: "FR", timeZone: "Europe/Paris", source: "manual" }, "fr");
  const [restaurant] = await provider.nearbyRestaurants(location, { language: "fr", radiusMeters: 3_000, dishQuery: "buckwheat galette Breton restaurant" });
  assert.equal(captured.url, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(captured.init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.nearbyRestaurants);
  assert.deepEqual(JSON.parse(captured.init.body), {
    textQuery: "buckwheat galette Breton restaurant",
    includedType: "restaurant",
    strictTypeFiltering: true,
    locationBias: { circle: { center: { latitude: 48.8566, longitude: 2.3522 }, radius: 3_000 } },
    rankPreference: "RELEVANCE",
    pageSize: 20,
    languageCode: "fr",
    regionCode: "FR",
  });
  assert.equal(restaurant.displayName, "La Maison des Crêpes");
});

test("restaurant details rejects a venue that is not a restaurant", async () => {
  const provider = new GooglePlacesProvider("server-secret", async () => Response.json({
    ...googleRestaurant({ id: "ChIJCinema123", name: "Cinema with concessions" }),
    primaryType: "movie_theater",
    types: ["movie_theater", "restaurant", "food"],
  }));
  await assert.rejects(() => provider.restaurantDetails("ChIJCinema123", "fr"), (error) => error.code === "invalid_request");
});

const regionalRestaurants = [
  { countryCode: "US", locality: "Austin", region: "TX", name: "Nixta Taqueria", language: "en-US", currency: "USD" },
  { countryCode: "CA", locality: "Montréal", region: "QC", name: "Au Pied de Cochon", language: "fr", currency: "CAD" },
  { countryCode: "MX", locality: "Guadalajara", region: "JAL", name: "Alcalde", language: "es", currency: "MXN" },
  { countryCode: "GB", locality: "Edinburgh", region: "Scotland", name: "The Palmerston", language: "en-GB", currency: "GBP" },
  { countryCode: "FR", locality: "Marseille", region: "Provence-Alpes-Côte d’Azur", name: "Chez Étienne", language: "fr", currency: "EUR" },
];

for (const fixture of regionalRestaurants) {
  test(`restaurant details normalize provider fixtures in ${fixture.countryCode}`, async () => {
    let fieldMask;
    const provider = new GooglePlacesProvider("server-secret", async (_url, init) => {
      fieldMask = init.headers["X-Goog-FieldMask"];
      return Response.json(googleRestaurant({ id: `Place${fixture.countryCode}123`, ...fixture }));
    });
    const restaurant = await provider.restaurantDetails(`Place${fixture.countryCode}123`, fixture.language);
    assert.equal(fieldMask, googleLocationFieldMasks.restaurantDetails);
    assert.equal(restaurant.displayName, fixture.name);
    assert.equal(restaurant.locality, fixture.locality);
    assert.equal(restaurant.countryCode, fixture.countryCode);
    assert.equal(restaurant.currencyCode, fixture.currency);
    assert.equal(restaurant.attribution, "Google Maps");
  });
}

test("photo references retain required authors, source and report links without fetching or caching media", async () => {
  const provider = new GooglePlacesProvider("server-secret", async (_url, init) => {
    assert.equal(init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.photos);
    return Response.json(googleRestaurant());
  });
  const [photo] = await provider.restaurantPhotos("ChIJRestaurant123");
  assert.equal(photo.reference, "places/ChIJRestaurant123/photos/photoABC");
  assert.equal(photo.authorAttributions[0].uri, "https://maps.google.com/contrib/example");
  assert.equal(photo.flagContentUri, "https://maps.google.com/photo/example/report");
});

test("distance calculations cover representative coordinates in all five countries", () => {
  const pairs = [
    [{ latitude: 40.7128, longitude: -74.006 }, { latitude: 34.0522, longitude: -118.2437 }, 3_900, 4_000],
    [{ latitude: 49.2827, longitude: -123.1207 }, { latitude: 43.6532, longitude: -79.3832 }, 3_300, 3_400],
    [{ latitude: 19.4326, longitude: -99.1332 }, { latitude: 20.6597, longitude: -103.3496 }, 450, 480],
    [{ latitude: 51.5072, longitude: -0.1276 }, { latitude: 55.9533, longitude: -3.1883 }, 520, 550],
    [{ latitude: 48.8566, longitude: 2.3522 }, { latitude: 45.764, longitude: 4.8357 }, 380, 410],
  ];
  for (const [from, to, minimum, maximum] of pairs) {
    const distance = haversineDistanceKm(from, to);
    assert.ok(distance > minimum && distance < maximum, `${distance} should be between ${minimum} and ${maximum}`);
    assert.equal(distance, haversineDistanceKm(to, from));
  }
});

test("transient quota failures retry once and remain explicit", async () => {
  let calls = 0;
  const provider = new GooglePlacesProvider("server-secret", async () => {
    calls += 1;
    return new Response("quota", { status: 429 });
  });
  await assert.rejects(() => provider.restaurantDetails("ChIJRestaurant123", "en-US"), (error) => error.code === "quota");
  assert.equal(calls, 2);
});

test("Google error status distinguishes quota from credentials and timeouts retry once", async () => {
  let quotaCalls = 0;
  const quotaProvider = new GooglePlacesProvider("server-secret", async () => {
    quotaCalls += 1;
    return Response.json({ error: { status: "RESOURCE_EXHAUSTED" } }, { status: 403 });
  });
  await assert.rejects(() => quotaProvider.restaurantDetails("ChIJRestaurant123", "en-US"), (error) => error.code === "quota");
  assert.equal(quotaCalls, 2);

  let timeoutCalls = 0;
  const timeoutProvider = new GooglePlacesProvider("server-secret", async (_url, init) => {
    timeoutCalls += 1;
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    }));
  }, 1);
  await assert.rejects(() => timeoutProvider.restaurantDetails("ChIJRestaurant123", "en-US"), (error) => error.code === "timeout");
  assert.equal(timeoutCalls, 2);
});

test("malformed live restaurant payloads are not presented as empty success", async () => {
  const provider = new GooglePlacesProvider("server-secret", async () => Response.json({ places: [{ id: "ChIJBroken123", displayName: { text: "Broken record" } }] }));
  const location = normalizeLocation({ latitude: 30.2672, longitude: -97.7431, locality: "Austin", administrativeRegion: "TX", countryCode: "US", timeZone: "America/Chicago", source: "manual" }, "en-US");
  await assert.rejects(() => provider.nearbyRestaurants(location, { language: "en-US" }), (error) => error.code === "unreadable_response");
});
