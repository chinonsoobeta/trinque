# Google Places provider integration

Phase 2 implements the first `PlacesProvider` adapter with Google Places API (New). Application routes and product types consume only normalized `LocationSuggestion`, `RestaurantPlace`, and `ProviderPhoto` objects. Raw Google response types remain inside the adapter so another provider can be added without rewriting routes, ranking, or UI code.

## Server routes

- `POST /api/locations/autocomplete` returns lightweight location predictions and resolves a chosen provider place ID or consented coordinates.
- `GET /api/restaurants/nearby?latitude=…&longitude=…&radiusMeters=…&language=…` validates the coordinate’s country, then returns normalized restaurants.
- `GET /api/restaurants/:providerId?language=…` returns normalized details for a stable Google place ID.

All routes require the server-only `GOOGLE_PLACES_API_KEY`. Missing credentials, quota, invalid requests, timeouts/unavailability, unreadable responses, and unsupported countries remain explicit error codes. No route substitutes demo or seeded content.

## Data and attribution

Restaurant results include provider/place ID, provider-returned display name, formatted address, coordinates, locality, administrative region, country, regional currency/locale, price level, rating, business/opening status, optional distance, Google Maps URI, provider attributions, and compliant photo references. Photo metadata preserves required author attribution, source-on-Google-Maps URI, and reporting URI. Trinque does not translate provider or restaurant names.

Google Maps content is visually attributable as `Google Maps` beside any client-rendered provider results. Third-party and photo author attributions travel with the normalized response for the future display surface.

## Field masks and caching

Production requests use explicit masks and never `*`. The provider asks only for fields in the normalized contracts. Requests use `Cache-Control: no-store`, a six-second timeout, and one retry for transient responses. Raw payloads and photo resource names are not persisted or cached.

This conservative cache policy follows Google’s current [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies): Places content must not be cached or stored beyond stated exceptions. Stable place IDs are the only provider value this phase treats as indefinitely storable. Photo names are explicitly not cached because they can expire. The implementation follows current official [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos), and [REST Place resource](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places) documentation.

The project owner must confirm the Google Maps Platform agreement and the EEA-specific terms/functionality applicable to the billing account before live validation in France. This is a provider-contract gate, not a claim of legal compliance.
