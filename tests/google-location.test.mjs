import assert from "node:assert/strict";
import test from "node:test";
import { GoogleLocationProvider, googleLocationFieldMasks } from "../lib/places/google-location.ts";
import { PlacesProviderError } from "../lib/places/types.ts";

test("Google autocomplete is country-bounded, field-masked and provider-neutral", async () => {
  let captured;
  const provider = new GoogleLocationProvider("server-secret", async (url, init) => {
    captured = { url, init };
    return Response.json({ suggestions: [{ placePrediction: { placeId: "ChIJLondon123", text: { text: "London, UK" }, structuredFormat: { mainText: { text: "London" }, secondaryText: { text: "United Kingdom" } } } }] });
  });
  const suggestions = await provider.autocomplete("Lon", { language: "en-GB", location: { latitude: 51.5, longitude: -0.12 } });
  assert.deepEqual(suggestions, [{ id: "google:ChIJLondon123", provider: "google", providerPlaceId: "ChIJLondon123", label: "London", secondaryLabel: "United Kingdom", attribution: "Google Maps" }]);
  assert.equal(captured.url, "https://places.googleapis.com/v1/places:autocomplete");
  assert.equal(captured.init.headers["X-Goog-Api-Key"], "server-secret");
  assert.equal(captured.init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.autocomplete);
  assert.equal(captured.init.cache, "no-store");
  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body.includedRegionCodes, ["us", "ca", "mx", "gb", "fr"]);
  assert.deepEqual(body.includedPrimaryTypes, ["(regions)"]);
  assert.equal(body.languageCode, "en-GB");
});

const fixtures = [
  ["US", "New York", "NY", "America/New_York", "en-US", "USD", "imperial"],
  ["CA", "Montréal", "QC", "America/Toronto", "fr", "CAD", "metric"],
  ["MX", "Ciudad de México", "CDMX", "America/Mexico_City", "es", "MXN", "metric"],
  ["GB", "London", "England", "Europe/London", "en-GB", "GBP", "imperial"],
  ["FR", "Lyon", "Auvergne-Rhône-Alpes", "Europe/Paris", "fr", "EUR", "metric"],
];

for (const [countryCode, locality, region, timeZone, language, currencyCode, measurementSystem] of fixtures) {
  test(`Google location details normalize ${countryCode} regional settings`, async () => {
    const provider = new GoogleLocationProvider("server-secret", async (_url, init) => {
      assert.equal(init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.location);
      return Response.json({
        id: `place-${countryCode}`,
        displayName: { text: locality },
        location: { latitude: 45.5, longitude: -73.57 },
        timeZone: { id: timeZone },
        addressComponents: [
          { longText: locality, shortText: locality, types: ["locality"] },
          { longText: region, shortText: region, types: ["administrative_area_level_1"] },
          { longText: countryCode, shortText: countryCode, types: ["country"] },
          { longText: "A1A 1A1", shortText: "A1A 1A1", types: ["postal_code"] },
        ],
      });
    });
    const normalized = await provider.resolveLocation(`place-${countryCode}`, language);
    assert.equal(normalized.countryCode, countryCode);
    assert.equal(normalized.locality, locality);
    assert.equal(normalized.administrativeRegion, region);
    assert.equal(normalized.timeZone, timeZone);
    assert.equal(normalized.currencyCode, currencyCode);
    assert.equal(normalized.measurementSystem, measurementSystem);
    assert.equal(normalized.language, language);
  });
}

test("coordinate resolution preserves device coordinates and rejects unsupported countries", async () => {
  const provider = new GoogleLocationProvider("server-secret", async (_url, init) => {
    assert.equal(init.headers["X-Goog-FieldMask"], googleLocationFieldMasks.coordinates);
    return Response.json({ places: [{
      location: { latitude: 52.52, longitude: 13.405 },
      timeZone: { id: "Europe/Berlin" },
      addressComponents: [
        { longText: "Berlin", types: ["locality"] },
        { longText: "Berlin", shortText: "BE", types: ["administrative_area_level_1"] },
        { longText: "Germany", shortText: "DE", types: ["country"] },
      ],
    }] });
  });
  await assert.rejects(() => provider.resolveCoordinates(52.52, 13.405, "en-GB"), (error) => error instanceof PlacesProviderError && error.code === "unsupported_country");
});

test("credentials and provider payload errors remain explicit", async () => {
  assert.throws(() => new GoogleLocationProvider(""), (error) => error.code === "credentials");
  const provider = new GoogleLocationProvider("server-secret", async () => new Response("not json", { status: 200 }));
  await assert.rejects(() => provider.autocomplete("Paris", { language: "fr" }), (error) => error.code === "unreadable_response");
});
