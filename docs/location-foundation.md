# Location, language, and theme foundation

## Regional contract

Trinque accepts normalized ISO country codes `US`, `CA`, `MX`, `GB`, and `FR`. This is a country allowlist, not a city list: any city or locality returned from coordinates or a manual provider search is accepted when its normalized country code is supported.

The location record carries latitude, longitude, locality, administrative region, country, optional postal code, IANA time zone, currency, regional formatting locale, selected UI language, measurement system, and consented source. Browser and iOS storage round coordinates to two decimal places and omit postal code; precise-location history is not retained.

UI language is an independent explicit preference. The typed resources have exact key parity for Canadian English (`en-CA`), American English (`en-US`), UK English (`en-GB`), French (`fr`), and Spanish (`es`). Regional currency, dates, time zone, address formatting, and distance do not change when the UI language changes.

## Live location flow

`POST /api/locations/autocomplete` uses a server-only `GOOGLE_PLACES_API_KEY` and returns provider-neutral predictions. A selected prediction is resolved through Place Details before it becomes a normalized location. Device coordinates are resolved server-side through Places Nearby Search after the user grants browser or iOS foreground permission. Unsupported countries are rejected after provider normalization.

Requests use explicit field masks, a short timeout, one bounded retry for transient failures, and `Cache-Control: no-store`. The client receives normalized records, stable provider place IDs, and required `Google Maps` text attribution—not raw Google payloads. Place content is not persisted by this phase.

Implementation follows the current Google Places API (New) documentation for [Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete), [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), and [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). France is technically supported, but the owner must review the Google Maps EEA terms that apply to the project billing account before a French live pilot.

Without `GOOGLE_PLACES_API_KEY`, health and location search report a `credentials`/unavailable state. The UI explains the missing capability and never substitutes Vancouver or seeded search results.

## Preferences and theme

Durable guest or trusted identities can save language, `system`/`light`/`dark` theme, measurement override, and one coarse current location in D1 through migration `0003`. Web also mirrors preferences in local storage; iOS uses AsyncStorage. New users start from system theme and the closest supported device language.

Web applies the saved theme in the document head before meaningful render and follows `prefers-color-scheme` in system mode. iOS waits for local preferences before rendering the principal UI, integrates with `Appearance`, uses adaptive semantic colors instead of inversion, and updates the status bar.

## Credential blocker

Live provider smoke tests cannot be run until the owner configures `GOOGLE_PLACES_API_KEY` in the Sites production/preview environment and confirms the applicable Google Maps Platform terms. Deterministic injected provider tests cover the implementation without committing a credential.
