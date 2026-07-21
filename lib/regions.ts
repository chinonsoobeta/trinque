/** Countries where Trinque can create or search a location. Keep this list as
 * the single source for user-facing country support and provider filtering. */
export const SUPPORTED_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "GB", "CA", "US", "MX",
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRY_CODES)[number];

export const SUPPORTED_LANGUAGES = ["en-CA", "en-US", "en-GB", "fr", "es", "de", "it", "pt"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ThemePreference = "system" | "light" | "dark";
export type MeasurementSystem = "metric" | "imperial";

export const SUPPORTED_CURRENCY_CODES = ["USD", "CAD", "MXN", "GBP", "EUR", "BGN", "CZK", "DKK", "HUF", "PLN", "RON", "SEK"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCY_CODES)[number];

export type RegionalDefaults = {
  currencyCode: SupportedCurrency;
  measurementSystem: MeasurementSystem;
  defaultLanguage: SupportedLanguage;
  formattingLocale: string;
};

export const REGIONAL_DEFAULTS: Readonly<Record<SupportedCountry, RegionalDefaults>> = {
  AT: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "de-AT" },
  BE: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "fr", formattingLocale: "fr-BE" },
  BG: { currencyCode: "BGN", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "bg-BG" },
  HR: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "hr-HR" },
  CY: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "en-CY" },
  CZ: { currencyCode: "CZK", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "cs-CZ" },
  DK: { currencyCode: "DKK", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "da-DK" },
  EE: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "et-EE" },
  FI: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "fi-FI" },
  DE: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "de-DE" },
  US: { currencyCode: "USD", measurementSystem: "imperial", defaultLanguage: "en-US", formattingLocale: "en-US" },
  CA: { currencyCode: "CAD", measurementSystem: "metric", defaultLanguage: "en-CA", formattingLocale: "en-CA" },
  MX: { currencyCode: "MXN", measurementSystem: "metric", defaultLanguage: "es", formattingLocale: "es-MX" },
  GB: { currencyCode: "GBP", measurementSystem: "imperial", defaultLanguage: "en-GB", formattingLocale: "en-GB" },
  FR: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "fr", formattingLocale: "fr-FR" },
  GR: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "el-GR" },
  HU: { currencyCode: "HUF", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "hu-HU" },
  IE: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "en-IE" },
  IT: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "it-IT" },
  LV: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "lv-LV" },
  LT: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "lt-LT" },
  LU: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "fr", formattingLocale: "fr-LU" },
  MT: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "en-MT" },
  NL: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "nl-NL" },
  PL: { currencyCode: "PLN", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "pl-PL" },
  PT: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "pt-PT" },
  RO: { currencyCode: "RON", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "ro-RO" },
  SK: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "sk-SK" },
  SI: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "sl-SI" },
  ES: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "es", formattingLocale: "es-ES" },
  SE: { currencyCode: "SEK", measurementSystem: "metric", defaultLanguage: "en-GB", formattingLocale: "sv-SE" },
};

const supportedCountrySet = new Set<string>(SUPPORTED_COUNTRY_CODES);

export function normalizeCountryCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isSupportedCountry(value: unknown): value is SupportedCountry {
  return supportedCountrySet.has(normalizeCountryCode(value));
}

export function supportedCountry(value: unknown): SupportedCountry | null {
  const normalized = normalizeCountryCode(value);
  return isSupportedCountry(normalized) ? normalized : null;
}
