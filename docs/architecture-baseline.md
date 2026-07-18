# Trinque architecture and pilot baseline

Baseline recorded on 2026-07-17 from clean commit `d6a2641` on `main`.

## Product thesis

Upload a dish, understand what makes it special, discover similar dishes nearby, and choose somewhere that works for the whole group.

## Present architecture

- The web product is a Next.js/vinext application deployed as a Cloudflare-compatible Sites Worker. API route handlers and React UI live together under `app/`.
- Durable relational data uses D1 through Drizzle. Schema is declared in `db/schema.ts`; ordered generated migrations are committed under `drizzle/`.
- Uploaded image bytes use the server-only `UPLOADS` R2 binding while D1 stores ownership and dish metadata.
- Identity supports durable guest tokens plus trusted ChatGPT identity headers. Authorization decisions remain server-side.
- Dish identification calls the OpenAI Responses API from the server with `gpt-5.6-sol`, an explicit `high` image-detail contract, structured output, and `store: false`.
- The Expo React Native client under `ios/` calls the same server API and persists only opaque session/client preferences on device.
- Live, demo, and unavailable identifier states are explicit. Demo data is opt-in and seeded; provider failure never changes a live request into a demo result.
- Existing nearby matches and group candidates are deterministic Vancouver-oriented prototype data. They are not suitable as live regional discovery and must remain confined to explicitly labeled demo/tests as the provider-backed graph is introduced.

## Regional contracts

Locations are accepted dynamically from coordinates or provider-normalized search results. There is no supported-city list. The only country allowlist is ISO `US`, `CA`, `MX`, `GB`, and `FR`.

UI language is independent from location-derived formatting. Supported languages are Canadian English (`en-CA`), American English (`en-US`), UK English (`en-GB`), French (`fr`), and Spanish (`es`). New users default by region/device, while explicit choices persist separately. Theme choices are `system`, `light`, and `dark`.

## Terminology

- **Restaurant:** Trinque's normalized record for a real-world dining place. It can reference a provider place, but is not the provider payload.
- **Dish:** A reviewed dish record with original display text plus stable matching concepts. A dish is not evidence that its associated restaurant currently serves it.
- **Provider place:** A place returned by an external provider and identified by that provider's stable place ID.
- **Provenance:** How a dish claim entered Trinque: AI-identified, community-submitted, restaurant-verified, menu-imported, or explicitly seeded demo data.
- **Verification:** The current evidence state for a dish claim: unverified, community-confirmed, restaurant-verified, stale, or disputed.
- **Availability:** A separate, time-sensitive statement of whether the dish is currently known to be available. Unknown availability must remain unknown.

## Safe capability health

`GET /api/health` reports OpenAI, Google Places, D1, and R2 independently as `available` or `unavailable`, with only safe reasons (`configured`, `missing_credential`, or `missing_binding`). It never returns secret values. Overall readiness is `ready` only when all four live capabilities are available; deterministic demo analysis remains independently reported.

When `GOOGLE_PLACES_API_KEY` is absent, live location search is unavailable. The product must explain that state and must not substitute Vancouver or seeded results.

## Regression baseline

The baseline `npm run verify` completed successfully:

- production vinext web build: passed;
- Node regression suite: 18 passed, 0 failed;
- iOS TypeScript check: passed;
- Expo iOS export: passed.

## Credential and external-validation blockers

- `GOOGLE_PLACES_API_KEY` is required for real Google Places requests and five-country live provider smoke tests.
- `OPENAI_API_KEY` is required for approved live identifier smoke fixtures and measured evaluation results.
- Physical-device validation, EAS/TestFlight operations, and any distribution change require the owner's Apple/Expo access and explicit authorization at the relevant release step.
- Sites access must remain at its current owner-only/shared level unless the owner explicitly approves a change.
