# Trinque regional pilot readiness report

Report date: 2026-07-18  ·  Validated source: `main` commit `57a0136`  ·  Recommendation: **NO-GO**

## Scope and validation anchors

Runtime support is dynamic for every locality in US, CA, MX, GB and FR. The 15 anchors in `lib/pilot-anchors.ts` are fixtures only: New York, Los Angeles, Austin; Vancouver, Toronto, Montréal; Mexico City, Guadalajara, Monterrey; London, Manchester, Edinburgh; Paris, Lyon and Marseille. No runtime city allowlist is derived from these fixtures.

## Automated evidence

- `npm run verify`: 72 tests passed; production web build passed; iOS TypeScript check and Expo export passed.
- `npm run lint`: 0 errors; seven pre-existing accessibility/performance warnings remain (image alt text and the existing web `<img>` path).
- Secret scan: no API-key/token/private-key signatures found.
- D1 migrations `0001` through `0008` apply in sequence; the latest migration adds consent-aware analytics, feedback, and client diagnostics.
- `npm run evaluate:identifier`: 50 planned cases across all five countries and all five UI languages; **unmeasured** because no approved image fixtures are present. No score is inferred.

## Provider and production checks

Mocked provider contracts cover all five countries, normalized addresses/coordinates/currency/time zones, attribution, retry/error taxonomy, and unsupported-country behavior. A live Google Places smoke test has not run: Sites production metadata currently exposes only the presence of `OPENAI_API_KEY`; `GOOGLE_PLACES_API_KEY` is not configured. The production Sites host is `https://trinque-dish-discovery.r7bv67rgkk.chatgpt.site` and remains custom owner-only.

## Privacy, operations, and group journey

Rate limits, request IDs, upload signatures, consent withdrawal, export/deletion, analytics/diagnostics consent gating, feedback, and three-session group authorization are covered by automated tests. A real three-device group journey, live provider search, live identifier smoke test, and physical-device/TestFlight run remain unexecuted because they require the owner’s configured production access/credentials and devices.

## iOS/TestFlight

`ios/eas.json` contains internal preview and store production profiles with public API/link variables only. `applinks:` entitlement and Worker AASA interception are implemented, but Apple verification requires `APPLE_DEVELOPER_TEAM_ID` and an unauthenticated HTTPS association endpoint. The current owner-only Sites policy blocks both the public API use case and Apple’s association fetch. No App Store/TestFlight submission was made.

## Go/no-go

NO-GO until the owner supplies/configures: Google Places production key and applicable provider agreement; an approved public/authenticated production API and AASA access design without weakening access accidentally; Apple Team ID; approved evaluation image fixtures; physical iPhone/TestFlight validation; and a real three-session group smoke test. The implementation is pilot-ready in code and test scaffolding, but these external checks are required before claiming a live regional pilot.
