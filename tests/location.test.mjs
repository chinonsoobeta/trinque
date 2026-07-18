import assert from "node:assert/strict";
import test from "node:test";
import { coarseLocation, formatDistance, normalizeLocation, requestDeviceCoordinates, resolveLanguage } from "../lib/location.ts";

const candidates = {
  US: { latitude: 40.7128, longitude: -74.006, locality: "New York", administrativeRegion: "NY", countryCode: "US", timeZone: "America/New_York", source: "manual" },
  CA: { latitude: 45.5019, longitude: -73.5674, locality: "Montréal", administrativeRegion: "QC", countryCode: "CA", timeZone: "America/Toronto", source: "manual" },
  MX: { latitude: 19.4326, longitude: -99.1332, locality: "Ciudad de México", administrativeRegion: "CDMX", countryCode: "MX", timeZone: "America/Mexico_City", source: "manual" },
  GB: { latitude: 51.5072, longitude: -0.1276, locality: "London", administrativeRegion: "England", countryCode: "GB", timeZone: "Europe/London", source: "manual" },
  FR: { latitude: 48.8566, longitude: 2.3522, locality: "Paris", administrativeRegion: "Île-de-France", countryCode: "FR", timeZone: "Europe/Paris", source: "manual" },
};

test("manual selections normalize all five countries without a city allowlist", () => {
  assert.equal(normalizeLocation(candidates.US, "en-US").currencyCode, "USD");
  assert.equal(normalizeLocation(candidates.CA, "fr").currencyCode, "CAD");
  assert.equal(normalizeLocation(candidates.MX, "es").measurementSystem, "metric");
  assert.equal(normalizeLocation(candidates.GB, "en-GB").measurementSystem, "imperial");
  assert.equal(normalizeLocation(candidates.FR, "fr").locale, "fr-FR");
});

test("unsupported countries are rejected clearly", () => {
  assert.throws(() => normalizeLocation({ ...candidates.FR, countryCode: "DE" }, "fr"), /unsupported_country/);
});

test("device permission denial always requires a manual fallback", async () => {
  const result = await requestDeviceCoordinates({ getCurrentPosition(_success, failure) { failure({ code: 1 }); } });
  assert.deepEqual(result, { status: "denied", manualRequired: true });
});

test("coarse persistence removes postal code and avoids precise history", () => {
  const coarse = coarseLocation(normalizeLocation({ ...candidates.CA, postalCode: "H2X 1Y4" }, "fr"));
  assert.equal(coarse.latitude, 45.5);
  assert.equal(coarse.longitude, -73.57);
  assert.equal(coarse.postalCode, undefined);
});

test("language preference is independent while distances follow measurement preference", () => {
  assert.equal(resolveLanguage({ countryCode: "GB", deviceLanguages: ["de-DE"] }), "en-GB");
  assert.equal(resolveLanguage({ countryCode: "FR", deviceLanguages: ["en-US"], explicitLanguage: "es" }), "es");
  assert.match(formatDistance(5, normalizeLocation(candidates.GB, "fr")), /3[,.]1/);
  assert.match(formatDistance(5, normalizeLocation(candidates.MX, "en-CA")), /5/);
});
