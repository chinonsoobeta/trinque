import type { NormalizedLocation } from "../location.ts";
import type { SupportedLanguage } from "../regions.ts";

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
};

export type RestaurantFilters = {
  radiusMeters?: number;
  language: SupportedLanguage;
};

export type ProviderPhoto = {
  provider: ProviderName;
  reference: string;
  width?: number;
  height?: number;
  attribution: "Google Maps";
};

export type RestaurantPlace = {
  provider: ProviderName;
  providerPlaceId: string;
  displayName: string;
  address: string;
  latitude: number;
  longitude: number;
  locality: string;
  administrativeRegion: string;
  countryCode: string;
  priceLevel?: string;
  rating?: number;
  openingStatus?: "open" | "closed" | "unknown";
  photos: ProviderPhoto[];
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
