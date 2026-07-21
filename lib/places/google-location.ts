import { normalizeLocation, type LocationCandidate, type NormalizedLocation } from "../location.ts";
import { REGIONAL_DEFAULTS, supportedCountry, type SupportedCountry, type SupportedLanguage } from "../regions.ts";
import {
  PlacesProviderError,
  type AutocompleteContext,
  type LocationResolver,
  type LocationSuggestion,
  type PlacesProvider,
  type ProviderPhoto,
  type RestaurantFilters,
  type RestaurantPlace,
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
const RESTAURANT_FIELDS = "id,displayName,formattedAddress,addressComponents,location,primaryType,types,priceLevel,rating,businessStatus,currentOpeningHours.openNow,photos,googleMapsUri,attributions";
const NEARBY_RESTAURANT_MASK = `places.${RESTAURANT_FIELDS.split(",").join(",places.")}`;
const PHOTO_MASK = "id,photos";

type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  timeZone?: { id?: string } | string;
  postalAddress?: { regionCode?: string; languageCode?: string; locality?: string; administrativeArea?: string; postalCode?: string };
  priceLevel?: string;
  rating?: number;
  businessStatus?: string;
  currentOpeningHours?: { openNow?: boolean };
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string; photoUri?: string }>;
    googleMapsUri?: string;
    flagContentUri?: string;
  }>;
  googleMapsUri?: string;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
};
type FetchLike = typeof fetch;

export class GooglePlacesProvider implements LocationResolver, PlacesProvider {
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
      languageCode: context.language,
    };
    // Places Autocomplete accepts no more than 15 regions. A selected location
    // is the reliable country scope for this search. Place Details still rejects
    // every country that Trinque does not support when no scope is available.
    if (context.countryCode) body.includedRegionCodes = [context.countryCode.toLowerCase()];
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

  async nearbyRestaurants(location: NormalizedLocation, filters: RestaurantFilters): Promise<RestaurantPlace[]> {
    const radius = Math.min(50_000, Math.max(100, Math.round(filters.radiusMeters ?? 5_000)));
    const dishQuery = filters.dishQuery?.trim().replace(/\s+/g, " ").slice(0, 240);
    const isDishSearch = Boolean(dishQuery);
    const payload = await this.requestJson<{ places?: GooglePlace[] }>(
      `${GOOGLE_API}/${isDishSearch ? "places:searchText" : "places:searchNearby"}`,
      {
        method: "POST",
        body: JSON.stringify(isDishSearch ? {
          textQuery: dishQuery,
          includedType: "restaurant",
          strictTypeFiltering: true,
          locationBias: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius } },
          rankPreference: "RELEVANCE",
          pageSize: 20,
          languageCode: filters.language,
          regionCode: location.countryCode,
        } : {
          includedTypes: ["restaurant"],
          includedPrimaryTypes: ["restaurant"],
          locationRestriction: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius } },
          rankPreference: "POPULARITY",
          maxResultCount: 20,
          languageCode: filters.language,
        }),
      },
      NEARBY_RESTAURANT_MASK,
    );
    const restaurants: RestaurantPlace[] = [];
    let unreadable = false;
    for (const place of payload.places ?? []) {
      try {
        if (!isRestaurantPlace(place)) continue;
        const normalized = normalizeGoogleRestaurant(place);
        restaurants.push({ ...normalized, distanceKm: haversineDistanceKm(location, normalized) });
      } catch (error) {
        if (error instanceof PlacesProviderError && error.code === "unreadable_response") unreadable = true;
      }
    }
    if (!restaurants.length && unreadable) throw new PlacesProviderError("unreadable_response", "The restaurant provider returned unreadable places.", 502);
    return restaurants;
  }

  async restaurantDetails(providerPlaceId: string, language: SupportedLanguage): Promise<RestaurantPlace> {
    const placeId = normalizePlaceId(providerPlaceId);
    if (!placeId) throw new PlacesProviderError("invalid_request", "Invalid provider place identifier.", 400);
    const place = await this.requestJson<GooglePlace>(
      `${GOOGLE_API}/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(language)}`,
      { method: "GET" },
      RESTAURANT_FIELDS,
    );
    if (!isRestaurantPlace(place)) throw new PlacesProviderError("invalid_request", "The selected place is not a restaurant.", 400);
    return normalizeGoogleRestaurant(place);
  }

  async restaurantPhotos(providerPlaceId: string): Promise<ProviderPhoto[]> {
    const placeId = normalizePlaceId(providerPlaceId);
    if (!placeId) throw new PlacesProviderError("invalid_request", "Invalid provider place identifier.", 400);
    const place = await this.requestJson<GooglePlace>(
      `${GOOGLE_API}/places/${encodeURIComponent(placeId)}`,
      { method: "GET" },
      PHOTO_MASK,
    );
    return normalizePhotos(place.photos);
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
          const providerStatus = await readProviderStatus(response);
          const error = mapHttpError(response.status, providerStatus);
          if (attempt === 0 && (error.code === "quota" || error.code === "unavailable")) continue;
          throw error;
        }
        try { return await response.json() as T; }
        catch { throw new PlacesProviderError("unreadable_response", "The location provider returned an unreadable response.", 502); }
      } catch (error) {
        if (error instanceof PlacesProviderError) throw error;
        const aborted = error instanceof Error && error.name === "AbortError";
        if (attempt === 0) continue;
        throw new PlacesProviderError(aborted ? "timeout" : "unavailable", aborted ? "The location provider timed out." : "The location provider is unavailable.", 503);
      } finally { clearTimeout(timer); }
    }
    throw new PlacesProviderError("unavailable", "The location provider is unavailable.", 503);
  }
}

function normalizeGoogleRestaurant(place: GooglePlace): RestaurantPlace {
  const providerPlaceId = normalizePlaceId(place.id);
  const displayName = place.displayName?.text?.trim();
  const components = place.addressComponents ?? [];
  const component = (...types: string[]) => components.find((item) => types.some((type) => item.types?.includes(type)));
  const rawCountryCode = component("country")?.shortText || place.postalAddress?.regionCode;
  const countryCode = supportedCountry(rawCountryCode);
  const locality = component("locality", "postal_town", "sublocality", "administrative_area_level_2")?.longText || place.postalAddress?.locality;
  const administrativeRegion = component("administrative_area_level_1")?.shortText || component("administrative_area_level_1")?.longText || place.postalAddress?.administrativeArea;
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!providerPlaceId || !displayName || !place.formattedAddress?.trim() || !countryCode || !locality?.trim() || !administrativeRegion?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const unsupported = Boolean(rawCountryCode) && countryCode === null;
    throw new PlacesProviderError(unsupported ? "unsupported_country" : "unreadable_response", "The restaurant provider response was incomplete.", unsupported ? 400 : 502);
  }
  const regional = REGIONAL_DEFAULTS[countryCode];
  return {
    provider: "google",
    providerPlaceId,
    displayName,
    address: place.formattedAddress.trim(),
    latitude: latitude as number,
    longitude: longitude as number,
    locality: locality.trim(),
    administrativeRegion: administrativeRegion.trim(),
    countryCode,
    currencyCode: regional.currencyCode,
    locale: regional.formattingLocale,
    priceLevel: normalizePriceLevel(place.priceLevel),
    rating: Number.isFinite(place.rating) ? Math.min(5, Math.max(0, place.rating as number)) : undefined,
    businessStatus: normalizeBusinessStatus(place.businessStatus),
    openingStatus: normalizeOpeningStatus(place),
    photos: normalizePhotos(place.photos),
    providerAttributions: (place.attributions ?? []).flatMap((item) => item.provider?.trim() ? [{ provider: item.provider.trim(), providerUri: item.providerUri }] : []),
    googleMapsUri: place.googleMapsUri,
    displayNameLanguageCode: place.displayName?.languageCode,
    attribution: "Google Maps",
  };
}

// Nearby Search filters restaurant services and restaurant primary types. Keep a
// defensive client-side exclusion for venue categories that can still carry a
// secondary food-service tag (for example, a cinema with concessions).
function isRestaurantPlace(place: GooglePlace): boolean {
  const primaryType = place.primaryType?.trim();
  if (!primaryType) return true;
  return !new Set([
    "movie_theater",
    "performing_arts_theater",
    "event_venue",
    "amusement_center",
  ]).has(primaryType);
}

function normalizePhotos(photos?: GooglePlace["photos"]): ProviderPhoto[] {
  return (photos ?? []).flatMap((photo) => {
    if (!photo.name?.startsWith("places/") || !photo.name.includes("/photos/")) return [];
    return [{
      provider: "google" as const,
      reference: photo.name,
      width: Number.isFinite(photo.widthPx) ? photo.widthPx : undefined,
      height: Number.isFinite(photo.heightPx) ? photo.heightPx : undefined,
      authorAttributions: (photo.authorAttributions ?? []).flatMap((author) => author.displayName?.trim() ? [{ displayName: author.displayName.trim(), uri: author.uri, photoUri: author.photoUri }] : []),
      googleMapsUri: photo.googleMapsUri,
      flagContentUri: photo.flagContentUri,
      attribution: "Google Maps" as const,
    }];
  }).slice(0, 10);
}

function normalizePriceLevel(value?: string): RestaurantPlace["priceLevel"] {
  const levels: Partial<Record<string, NonNullable<RestaurantPlace["priceLevel"]>>> = { PRICE_LEVEL_FREE: "free", PRICE_LEVEL_INEXPENSIVE: "inexpensive", PRICE_LEVEL_MODERATE: "moderate", PRICE_LEVEL_EXPENSIVE: "expensive", PRICE_LEVEL_VERY_EXPENSIVE: "very_expensive" };
  return value ? levels[value] : undefined;
}

function normalizeBusinessStatus(value?: string): RestaurantPlace["businessStatus"] {
  const statuses: Partial<Record<string, NonNullable<RestaurantPlace["businessStatus"]>>> = { OPERATIONAL: "operational", CLOSED_TEMPORARILY: "temporarily_closed", CLOSED_PERMANENTLY: "permanently_closed", FUTURE_OPENING: "future_opening" };
  return value ? statuses[value] ?? "unknown" : "unknown";
}

function normalizeOpeningStatus(place: GooglePlace): RestaurantPlace["openingStatus"] {
  if (place.businessStatus === "CLOSED_TEMPORARILY" || place.businessStatus === "CLOSED_PERMANENTLY") return "closed";
  if (typeof place.currentOpeningHours?.openNow === "boolean") return place.currentOpeningHours.openNow ? "open" : "closed";
  return "unknown";
}

export function haversineDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLng = radians(b.longitude - a.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6_371.0088 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
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

async function readProviderStatus(response: Response): Promise<string | undefined> {
  try {
    const payload = await response.json() as { error?: { status?: unknown } };
    return typeof payload.error?.status === "string" ? payload.error.status : undefined;
  } catch { return undefined; }
}

function mapHttpError(status: number, providerStatus?: string): PlacesProviderError {
  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED") return new PlacesProviderError("quota", "Google Places quota is temporarily unavailable.", 503);
  if (status === 401 || status === 403 || providerStatus === "PERMISSION_DENIED" || providerStatus === "UNAUTHENTICATED") return new PlacesProviderError("credentials", "Google Places credentials were rejected.", 503);
  if (status >= 400 && status < 500) return new PlacesProviderError("invalid_request", "Google Places rejected the location request.", 400);
  return new PlacesProviderError("unavailable", "Google Places is temporarily unavailable.", 503);
}

export const googleLocationFieldMasks = { autocomplete: AUTOCOMPLETE_MASK, location: LOCATION_MASK, coordinates: COORDINATE_MASK, nearbyRestaurants: NEARBY_RESTAURANT_MASK, restaurantDetails: RESTAURANT_FIELDS, photos: PHOTO_MASK } as const;
export { GooglePlacesProvider as GoogleLocationProvider };
