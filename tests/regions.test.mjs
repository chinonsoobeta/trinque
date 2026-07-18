import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupportedCountry,
  REGIONAL_DEFAULTS,
  supportedCountry,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LANGUAGES,
} from "../lib/regions.ts";

test("country allowlist accepts exactly the five regional pilot countries", () => {
  assert.deepEqual(SUPPORTED_COUNTRY_CODES, ["US", "CA", "MX", "GB", "FR"]);
  for (const countryCode of SUPPORTED_COUNTRY_CODES) assert.equal(isSupportedCountry(countryCode), true);
  for (const countryCode of ["AU", "DE", "IE", "JP", "", null, undefined]) assert.equal(isSupportedCountry(countryCode), false);
  assert.equal(supportedCountry(" ca "), "CA");
});

test("regional defaults include UK English and remain separate from formatting", () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ["en-CA", "en-US", "en-GB", "fr", "es"]);
  assert.equal(REGIONAL_DEFAULTS.GB.defaultLanguage, "en-GB");
  assert.equal(REGIONAL_DEFAULTS.GB.currencyCode, "GBP");
  assert.equal(REGIONAL_DEFAULTS.CA.measurementSystem, "metric");
  assert.equal(REGIONAL_DEFAULTS.MX.defaultLanguage, "es");
  assert.equal(REGIONAL_DEFAULTS.FR.currencyCode, "EUR");
});
