# Trinque regional pilot readiness report

Report date: 2026-07-18  ·  Validated source: `main` commit `63343b3`  ·  Recommendation: **NO-GO**

## Scope and validation anchors

Runtime support is dynamic for every locality in US, CA, MX, GB and FR. The 15 anchors in `lib/pilot-anchors.ts` are fixtures only: New York, Los Angeles, Austin; Vancouver, Toronto, Montréal; Mexico City, Guadalajara, Monterrey; London, Manchester, Edinburgh; Paris, Lyon and Marseille. No runtime city allowlist is derived from these fixtures.

## Automated evidence

- `npm run verify`: 74 tests passed; production web build passed; iOS TypeScript check and Expo export passed.
- `npm run lint`: 0 errors; seven pre-existing accessibility/performance warnings remain (image alt text and the existing web `<img>` path).
- Secret scan: no API-key/token/private-key signatures found.
- D1 migrations `0001` through `0008` apply in sequence; the latest migration adds consent-aware analytics, feedback, and client diagnostics.
- `npm run evaluate:identifier`: 50 planned cases across all five countries and all five UI languages; **unmeasured** because no approved image fixtures are present. No score is inferred.

## Provider and production checks

Mocked provider contracts cover all five countries, normalized addresses/coordinates/currency/time zones, attribution, retry/error taxonomy, and unsupported-country behavior. `GOOGLE_PLACES_API_KEY` is configured as a server-side Sites secret. On 2026-07-18, deployed live nearby searches returned restaurant results and correct country/currency/time-zone/measurement normalization for New York (US), Toronto (CA), Mexico City (MX), London (GB), and Paris (FR); a Paris restaurant-detail response included Google Maps attribution. A follow-up provider guard filters non-restaurant primary types before the normalized response. The production Sites host is `https://trinque-dish-discovery.r7bv67rgkk.chatgpt.site` and remains custom owner-only.

## Privacy, operations, and group journey

Rate limits, request IDs, upload signatures, consent withdrawal, export/deletion, analytics/diagnostics consent gating, feedback, and three-session group authorization are covered by automated tests. The live provider search is complete. A temporary production guest used for this read-only check was deleted through Trinque’s privacy deletion endpoint immediately afterward. A real three-device group journey, live identifier smoke test, and physical-device/TestFlight run remain unexecuted because they require approved fixture rights, production access for participants, and owner devices/accounts.

## iOS/TestFlight

`ios/eas.json` contains internal preview and store production profiles with public API/link variables only. `applinks:` entitlement and Worker AASA interception are implemented, but Apple verification requires `APPLE_DEVELOPER_TEAM_ID` and an unauthenticated HTTPS association endpoint. The current owner-only Sites policy blocks both the public API use case and Apple’s association fetch. No App Store/TestFlight submission was made.

## Go/no-go

NO-GO until the owner confirms Google billing, API restrictions, and applicable provider/EEA terms; approves a participant-facing production API and AASA access design without weakening access accidentally; supplies Apple Team ID; provides approved evaluation image fixtures; completes physical iPhone/TestFlight validation; and runs a real three-session group smoke test. The implementation is pilot-ready in code and test scaffolding, but these external checks are required before claiming a live regional pilot.
