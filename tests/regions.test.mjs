import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupportedCountry,
  REGIONAL_DEFAULTS,
  supportedCountry,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LANGUAGES,
} from "../lib/regions.ts";

test("country allowlist accepts every required country and rejects unsupported countries", () => {
  assert.deepEqual(SUPPORTED_COUNTRY_CODES, ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CA", "US", "MX"]);
  for (const countryCode of SUPPORTED_COUNTRY_CODES) assert.equal(isSupportedCountry(countryCode), true);
  for (const countryCode of SUPPORTED_COUNTRY_CODES) {
    assert.ok(REGIONAL_DEFAULTS[countryCode].currencyCode);
    assert.ok(REGIONAL_DEFAULTS[countryCode].formattingLocale);
  }
  for (const countryCode of ["AU", "CH", "NO", "JP", "", null, undefined]) assert.equal(isSupportedCountry(countryCode), false);
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
