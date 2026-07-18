import {
  isSupportedCountry,
  REGIONAL_DEFAULTS,
  type MeasurementSystem,
  type SupportedCountry,
  type SupportedLanguage,
} from "./regions.ts";

export type LocationSource = "device" | "manual";

export type NormalizedLocation = {
  latitude: number;
  longitude: number;
  locality: string;
  administrativeRegion: string;
  countryCode: SupportedCountry;
  postalCode?: string;
  timeZone: string;
  currencyCode: string;
  locale: string;
  language: SupportedLanguage;
  measurementSystem: MeasurementSystem;
  source: LocationSource;
};

export type LocationCandidate = Omit<NormalizedLocation, "currencyCode" | "locale" | "language" | "measurementSystem"> & {
  currencyCode?: string;
  locale?: string;
  measurementSystem?: MeasurementSystem;
};

export type GeolocationAdapter = {
  getCurrentPosition(
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    failure: (error: { code?: number; message?: string }) => void,
    options: { enableHighAccuracy: false; timeout: number; maximumAge: number },
  ): void;
};

export type DeviceLocationResult =
  | { status: "granted"; coordinates: { latitude: number; longitude: number } }
  | { status: "denied" | "unavailable"; manualRequired: true };

export function normalizeLocation(candidate: LocationCandidate, language: SupportedLanguage): NormalizedLocation {
  if (!Number.isFinite(candidate.latitude) || candidate.latitude < -90 || candidate.latitude > 90) throw new Error("invalid_latitude");
  if (!Number.isFinite(candidate.longitude) || candidate.longitude < -180 || candidate.longitude > 180) throw new Error("invalid_longitude");
  if (!isSupportedCountry(candidate.countryCode)) throw new Error("unsupported_country");
  if (!candidate.locality.trim() || !candidate.administrativeRegion.trim() || !candidate.timeZone.trim()) throw new Error("incomplete_location");
  const defaults = REGIONAL_DEFAULTS[candidate.countryCode];
  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    locality: candidate.locality.trim(),
    administrativeRegion: candidate.administrativeRegion.trim(),
    countryCode: candidate.countryCode,
    postalCode: candidate.postalCode?.trim() || undefined,
    timeZone: candidate.timeZone.trim(),
    currencyCode: candidate.currencyCode?.trim().toUpperCase() || defaults.currencyCode,
    locale: candidate.locale?.trim() || defaults.formattingLocale,
    language,
    measurementSystem: candidate.measurementSystem ?? defaults.measurementSystem,
    source: candidate.source,
  };
}

export function coarseLocation(location: NormalizedLocation): NormalizedLocation {
  return {
    ...location,
    latitude: Math.round(location.latitude * 100) / 100,
    longitude: Math.round(location.longitude * 100) / 100,
    postalCode: undefined,
  };
}

export function formatDistance(distanceKm: number, location: Pick<NormalizedLocation, "language" | "measurementSystem">): string {
  const imperial = location.measurementSystem === "imperial";
  const value = imperial ? distanceKm * 0.621371 : distanceKm;
  return new Intl.NumberFormat(location.language, {
    style: "unit",
    unit: imperial ? "mile" : "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

export function resolveLanguage({
  countryCode,
  deviceLanguages,
  explicitLanguage,
}: {
  countryCode: SupportedCountry;
  deviceLanguages: readonly string[];
  explicitLanguage?: SupportedLanguage | null;
}): SupportedLanguage {
  if (explicitLanguage) return explicitLanguage;
  const normalized = deviceLanguages.map((value) => value.toLowerCase());
  if (normalized.some((value) => value === "en-gb" || value.startsWith("en-gb-"))) return "en-GB";
  if (normalized.some((value) => value === "en-ca" || value.startsWith("en-ca-"))) return "en-CA";
  if (normalized.some((value) => value === "en-us" || value.startsWith("en-us-"))) return "en-US";
  if (normalized.some((value) => value === "fr" || value.startsWith("fr-"))) return "fr";
  if (normalized.some((value) => value === "es" || value.startsWith("es-"))) return "es";
  return REGIONAL_DEFAULTS[countryCode].defaultLanguage;
}

export function requestDeviceCoordinates(adapter: GeolocationAdapter, timeout = 10_000): Promise<DeviceLocationResult> {
  return new Promise((resolve) => {
    adapter.getCurrentPosition(
      ({ coords }) => resolve({ status: "granted", coordinates: { latitude: coords.latitude, longitude: coords.longitude } }),
      (error) => resolve(error.code === 1 ? { status: "denied", manualRequired: true } : { status: "unavailable", manualRequired: true }),
      { enableHighAccuracy: false, timeout, maximumAge: 15 * 60 * 1000 },
    );
  });
}
