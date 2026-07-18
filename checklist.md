# Trinque phased acceptance checklist

## Phase 0 — identifier transparency and live analysis

- [x] Live analysis uses the OpenAI Responses API with `gpt-5.6-sol`, high-detail image input, low reasoning, and structured output.
- [x] Live, demo, unavailable, and provider-error states are distinct in the API and UI.
- [x] Failed live analysis never silently returns a canned dish.
- [x] Users review and can correct every inferred field before publishing.

## Phase 1 — identity and persistence

- [x] Server-created opaque guest sessions persist across web and iOS launches.
- [x] Trusted hosting identity headers are supported without client impersonation.
- [x] Saves and preferences use D1 as the authoritative store.

## Phase 2 — publish and nearby matching

- [x] Reviewed dishes and uploaded images persist to D1 and R2.
- [x] Publishing inserts the real dish into the feed.
- [x] Nearby matches are ranked from reviewed fields and include explanations, distance, price, and dietary caveats.

## Phase 3 — group planning

- [x] A guest can create and later restore a plan with budget, distance, vegetarian, and allergy constraints.
- [x] Eligible candidates are explainable; votes persist; finalize cannot select an ineligible option.
- [x] The journey completes with a locked winner, RSVP, and calendar export.

## Phase 4 — release readiness

- [x] `npm run verify` gates the production web build, regression tests, iOS type-check, and iOS export.
- [x] GitHub Actions enforces the same gate.
- [x] `/api/health` safely reports capability availability.
- [ ] Sites production secret `OPENAI_API_KEY` is configured (owner action; never commit it).
