import type { NormalizedLocation } from "../location.ts";
import type { SupportedCountry, SupportedLanguage } from "../regions.ts";

export type ProviderName = "google";

export type LocationSuggestion = {
  id: string;
  provider: ProviderName;
  providerPlaceId: string;
  label: string;
  secondaryLabel: string;
  attribution: "Google Maps";
};

export type AutocompleteContext = {
  language: SupportedLanguage;
  location?: Pick<NormalizedLocation, "latitude" | "longitude"> | null;
  /** Google permits at most 15 region codes per autocomplete request. */
  countryCode?: SupportedCountry | null;
};

export type RestaurantFilters = {
  radiusMeters?: number;
  language: SupportedLanguage;
  /** A reviewed dish/cuisine query. Results remain restaurant-level suggestions, not menu claims. */
  dishQuery?: string;
};

export type ProviderPhoto = {
  provider: ProviderName;
  reference: string;
  width?: number;
  height?: number;
  authorAttributions: Array<{ displayName: string; uri?: string; photoUri?: string }>;
  googleMapsUri?: string;
  flagContentUri?: string;
  attribution: "Google Maps";
};

export type ProviderAttribution = { provider: string; providerUri?: string };

export type RestaurantPlace = {
  provider: ProviderName;
  providerPlaceId: string;
  displayName: string;
  address: string;
  latitude: number;
  longitude: number;
  locality: string;
  administrativeRegion: string;
  countryCode: SupportedCountry;
  currencyCode: string;
  locale: string;
  priceLevel?: "free" | "inexpensive" | "moderate" | "expensive" | "very_expensive";
  rating?: number;
  businessStatus?: "operational" | "temporarily_closed" | "permanently_closed" | "future_opening" | "unknown";
  openingStatus?: "open" | "closed" | "unknown";
  distanceKm?: number;
  photos: ProviderPhoto[];
  providerAttributions: ProviderAttribution[];
  googleMapsUri?: string;
  displayNameLanguageCode?: string;
  attribution: "Google Maps";
};

export interface PlacesProvider {
  autocomplete(input: string, context: AutocompleteContext): Promise<LocationSuggestion[]>;
  nearbyRestaurants(location: NormalizedLocation, filters: RestaurantFilters): Promise<RestaurantPlace[]>;
  restaurantDetails(providerPlaceId: string, language: SupportedLanguage): Promise<RestaurantPlace>;
  restaurantPhotos(providerPlaceId: string): Promise<ProviderPhoto[]>;
}

export interface LocationResolver {
  resolveLocation(providerPlaceId: string, language: SupportedLanguage): Promise<NormalizedLocation>;
  resolveCoordinates(latitude: number, longitude: number, language: SupportedLanguage): Promise<NormalizedLocation>;
}

export type PlacesErrorCode = "credentials" | "quota" | "invalid_request" | "unavailable" | "timeout" | "unreadable_response" | "unsupported_country";

export class PlacesProviderError extends Error {
  readonly code: PlacesErrorCode;
  readonly status: number;

  constructor(code: PlacesErrorCode, message: string, status = 503) {
    super(message);
    this.name = "PlacesProviderError";
    this.code = code;
    this.status = status;
  }
}
