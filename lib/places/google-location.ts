import { normalizeLocation, type LocationCandidate, type NormalizedLocation } from "../location.ts";
import { SUPPORTED_COUNTRY_CODES, type SupportedCountry, type SupportedLanguage } from "../regions.ts";
import {
  PlacesProviderError,
  type AutocompleteContext,
  type LocationResolver,
  type LocationSuggestion,
} from "./types.ts";

const GOOGLE_API = "https://places.googleapis.com/v1";
const AUTOCOMPLETE_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");
const LOCATION_MASK = "id,displayName,formattedAddress,addressComponents,location,timeZone,postalAddress";
const COORDINATE_MASK = `places.${LOCATION_MASK.split(",").join(",places.")}`;

type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  timeZone?: { id?: string } | string;
  postalAddress?: { regionCode?: string; languageCode?: string; locality?: string; administrativeArea?: string; postalCode?: string };
};
type FetchLike = typeof fetch;

export class GoogleLocationProvider implements LocationResolver {
  private readonly apiKey: string;
  private readonly fetcher: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string,
    fetcher: FetchLike = fetch,
    timeoutMs = 6_000,
  ) {
    if (!apiKey.trim()) throw new PlacesProviderError("credentials", "Google Places is not configured.", 503);
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }

  async autocomplete(input: string, context: AutocompleteContext): Promise<LocationSuggestion[]> {
    const query = input.trim();
    if (query.length < 2 || query.length > 160) throw new PlacesProviderError("invalid_request", "Enter at least two characters.", 400);
    const body: Record<string, unknown> = {
      input: query,
      includedRegionCodes: SUPPORTED_COUNTRY_CODES.map((country) => country.toLowerCase()),
      includedPrimaryTypes: ["(regions)"],
      languageCode: context.language,
    };
    if (context.location) {
      body.locationBias = { circle: { center: context.location, radius: 50_000 } };
    }
    const payload = await this.requestJson<{ suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }> }>(
      `${GOOGLE_API}/places:autocomplete`,
      { method: "POST", body: JSON.stringify(body) },
      AUTOCOMPLETE_MASK,
    );
    return (payload.suggestions ?? []).flatMap(({ placePrediction }) => {
      const providerPlaceId = normalizePlaceId(placePrediction?.placeId);
      if (!providerPlaceId) return [];
      const label = placePrediction?.structuredFormat?.mainText?.text?.trim() || placePrediction?.text?.text?.trim();
      if (!label) return [];
      return [{
        id: `google:${providerPlaceId}`,
        provider: "google" as const,
        providerPlaceId,
        label,
        secondaryLabel: placePrediction?.structuredFormat?.secondaryText?.text?.trim() || "",
        attribution: "Google Maps" as const,
      }];
    }).slice(0, 5);
  }

  async resolveLocation(providerPlaceId: string, language: SupportedLanguage): Promise<NormalizedLocation> {
    const placeId = normalizePlaceId(providerPlaceId);
    if (!placeId) throw new PlacesProviderError("invalid_request", "Invalid provider place identifier.", 400);
    const place = await this.requestJson<GooglePlace>(
      `${GOOGLE_API}/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(language)}`,
      { method: "GET" },
      LOCATION_MASK,
    );
    return normalizeGoogleLocation(place, language, "manual");
  }

  async resolveCoordinates(latitude: number, longitude: number, language: SupportedLanguage): Promise<NormalizedLocation> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new PlacesProviderError("invalid_request", "Invalid coordinates.", 400);
    }
    const payload = await this.requestJson<{ places?: GooglePlace[] }>(
      `${GOOGLE_API}/places:searchNearby`,
      {
        method: "POST",
        body: JSON.stringify({
          locationRestriction: { circle: { center: { latitude, longitude }, radius: 5_000 } },
          rankPreference: "DISTANCE",
          maxResultCount: 1,
          languageCode: language,
        }),
      },
      COORDINATE_MASK,
    );
    const nearest = payload.places?.[0];
    if (!nearest) throw new PlacesProviderError("unavailable", "No location could be resolved for these coordinates.", 503);
    return normalizeGoogleLocation({ ...nearest, location: { latitude, longitude } }, language, "device");
  }

  private async requestJson<T>(url: string, init: RequestInit, fieldMask: string): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": fieldMask,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = mapHttpError(response.status);
          if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
          throw error;
        }
        try { return await response.json() as T; }
        catch { throw new PlacesProviderError("unreadable_response", "The location provider returned an unreadable response.", 502); }
      } catch (error) {
        if (error instanceof PlacesProviderError) throw error;
        const aborted = error instanceof Error && error.name === "AbortError";
        if (attempt === 0 && aborted) continue;
        throw new PlacesProviderError(aborted ? "timeout" : "unavailable", aborted ? "The location provider timed out." : "The location provider is unavailable.", 503);
      } finally { clearTimeout(timer); }
    }
    throw new PlacesProviderError("unavailable", "The location provider is unavailable.", 503);
  }
}

function normalizeGoogleLocation(place: GooglePlace, language: SupportedLanguage, source: "manual" | "device"): NormalizedLocation {
  const components = place.addressComponents ?? [];
  const postal = place.postalAddress;
  const component = (...types: string[]) => components.find((item) => types.some((type) => item.types?.includes(type)));
  const countryCode = (component("country")?.shortText || postal?.regionCode || "").toUpperCase();
  const locality = component("locality", "postal_town", "sublocality", "administrative_area_level_2")?.longText || postal?.locality || place.displayName?.text;
  const administrativeRegion = component("administrative_area_level_1")?.shortText || component("administrative_area_level_1")?.longText || postal?.administrativeArea;
  const timeZone = typeof place.timeZone === "string" ? place.timeZone : place.timeZone?.id;
  const candidate: LocationCandidate = {
    latitude: place.location?.latitude ?? Number.NaN,
    longitude: place.location?.longitude ?? Number.NaN,
    locality: locality ?? "",
    administrativeRegion: administrativeRegion ?? "",
    countryCode: countryCode as SupportedCountry,
    postalCode: component("postal_code")?.longText || postal?.postalCode,
    timeZone: timeZone ?? "",
    source,
  };
  try { return normalizeLocation(candidate, language); }
  catch (error) {
    const code = error instanceof Error && error.message === "unsupported_country" ? "unsupported_country" : "unreadable_response";
    const status = code === "unsupported_country" ? 400 : 502;
    throw new PlacesProviderError(code, code === "unsupported_country" ? "This location is outside Trinque's supported countries." : "The location provider response was incomplete.", status);
  }
}

function normalizePlaceId(value?: string): string | null {
  const placeId = value?.replace(/^places\//, "").trim();
  return placeId && /^[A-Za-z0-9_-]{4,256}$/.test(placeId) ? placeId : null;
}

function mapHttpError(status: number): PlacesProviderError {
  if (status === 401 || status === 403) return new PlacesProviderError("credentials", "Google Places credentials were rejected.", 503);
  if (status === 429) return new PlacesProviderError("quota", "Google Places quota is temporarily unavailable.", 503);
  if (status >= 400 && status < 500) return new PlacesProviderError("invalid_request", "Google Places rejected the location request.", 400);
  return new PlacesProviderError("unavailable", "Google Places is temporarily unavailable.", 503);
}

export const googleLocationFieldMasks = { autocomplete: AUTOCOMPLETE_MASK, location: LOCATION_MASK, coordinates: COORDINATE_MASK } as const;
