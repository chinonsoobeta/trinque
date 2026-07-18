# Trinque regional pilot readiness report

Report date: 2026-07-18  ·  Validated source: `main` commit `07d8b09`  ·  Recommendation: **NO-GO**

## Scope and validation anchors

Runtime support is dynamic for every locality in US, CA, MX, GB and FR. The 15 anchors in `lib/pilot-anchors.ts` are fixtures only: New York, Los Angeles, Austin; Vancouver, Toronto, Montréal; Mexico City, Guadalajara, Monterrey; London, Manchester, Edinburgh; Paris, Lyon and Marseille. No runtime city allowlist is derived from these fixtures.

## Automated evidence

- `npm run verify`: 74 tests passed; production web build passed; iOS TypeScript check and Expo export passed.
- `npm run lint`: 0 errors; seven pre-existing accessibility/performance warnings remain (image alt text and the existing web `<img>` path).
- Secret scan: no API-key/token/private-key signatures found.
- D1 migrations `0001` through `0008` apply in sequence; the latest migration adds consent-aware analytics, feedback, and client diagnostics.
- `npm run evaluate:identifier`: 50 planned cases across all five countries and all five UI languages; **unmeasured** because no approved image fixtures are present. No score is inferred.

## Provider and production checks

Mocked provider contracts cover all five countries, normalized addresses/coordinates/currency/time zones, attribution, retry/error taxonomy, and unsupported-country behavior. `GOOGLE_PLACES_API_KEY` is configured as a server-side Sites secret. On 2026-07-18, deployed live nearby searches returned restaurant results and correct country/currency/time-zone/measurement normalization for New York (US), Toronto (CA), Mexico City (MX), London (GB), and Paris (FR); a Paris restaurant-detail response included Google Maps attribution. A follow-up provider guard filters non-restaurant primary types before the normalized response. The production Sites host is `https://trinque-dish-discovery.r7bv67rgkk.chatgpt.site` and is public by owner approval.

## Privacy, operations, and group journey

Rate limits, request IDs, upload signatures, consent withdrawal, export/deletion, analytics/diagnostics consent gating, feedback, and three-session group authorization are covered by automated tests. The live provider search is complete. A temporary production guest used for this read-only check was deleted through Trinque’s privacy deletion endpoint immediately afterward. On 2026-07-18, three independent public guest sessions created and joined a Toronto group; each could read the same plan with its correct owner/participant role, and all test identities were then deleted. The fresh plan had only restaurant-level alternatives with unknown prices, so every candidate was correctly ineligible and finalization was not attempted. A live identifier smoke test and physical-device/TestFlight run remain unexecuted because approved fixture files and owner devices/accounts are still required.

## iOS/TestFlight

`ios/eas.json` contains internal preview and store production profiles with public API/link variables only. `applinks:` entitlement and Worker AASA interception are implemented, but Apple verification requires `APPLE_DEVELOPER_TEAM_ID` and an unauthenticated HTTPS association endpoint. The current owner-only Sites policy blocks both the public API use case and Apple’s association fetch. No App Store/TestFlight submission was made.

## Go/no-go

NO-GO until approved evaluation image fixtures are supplied and a live identifier smoke test is measured; a real group plan has at least one eligible candidate and completes voting/finalization/independent RSVPs/calendar export; Apple Team ID and an approved AASA design are supplied for iOS; and physical iPhone/TestFlight validation completes. Google billing, Places restrictions, and applicable France terms have been owner-confirmed. The implementation is pilot-ready in code and test scaffolding, but these external checks are required before claiming a live regional pilot.
