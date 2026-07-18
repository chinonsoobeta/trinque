export const SUPPORTED_COUNTRY_CODES = ["US", "CA", "MX", "GB", "FR"] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRY_CODES)[number];

export const SUPPORTED_LANGUAGES = ["en-CA", "en-US", "en-GB", "fr", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ThemePreference = "system" | "light" | "dark";
export type MeasurementSystem = "metric" | "imperial";

export type RegionalDefaults = {
  currencyCode: "USD" | "CAD" | "MXN" | "GBP" | "EUR";
  measurementSystem: MeasurementSystem;
  defaultLanguage: SupportedLanguage;
  formattingLocale: string;
};

export const REGIONAL_DEFAULTS: Readonly<Record<SupportedCountry, RegionalDefaults>> = {
  US: { currencyCode: "USD", measurementSystem: "imperial", defaultLanguage: "en-US", formattingLocale: "en-US" },
  CA: { currencyCode: "CAD", measurementSystem: "metric", defaultLanguage: "en-CA", formattingLocale: "en-CA" },
  MX: { currencyCode: "MXN", measurementSystem: "metric", defaultLanguage: "es", formattingLocale: "es-MX" },
  GB: { currencyCode: "GBP", measurementSystem: "imperial", defaultLanguage: "en-GB", formattingLocale: "en-GB" },
  FR: { currencyCode: "EUR", measurementSystem: "metric", defaultLanguage: "fr", formattingLocale: "fr-FR" },
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
