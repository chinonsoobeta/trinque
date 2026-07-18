import { GooglePlacesProvider } from "./google-location.ts";
import type { LocationResolver, PlacesProvider } from "./types.ts";

export type TrinquePlacesProvider = PlacesProvider & LocationResolver;

export function createPlacesProvider(apiKey: string, fetcher: typeof fetch = fetch): TrinquePlacesProvider {
  return new GooglePlacesProvider(apiKey, fetcher);
}
