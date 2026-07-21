# Trinque pilot readiness report

Report date: 2026-07-21. Validated source: current working tree after the safety and language implementation. Recommendation: **NO-GO**.

## What passed locally

- `npm run lint` passed with no errors.
- `npm run verify` passed through the production build and 91 web tests after one stale source-location assertion was updated. The focused rerun then passed 15 localization, safety, and UI tests. `npm run test:ios` passed the iOS type check and Expo export.
- The clean D1 test applies migrations `0000` through `0012`. It checks the social, group, onboarding, and safety tables.
- Region tests cover all 27 EU countries, GB, CA, US, MX, and an unsupported country. The supported-country list is shared in `lib/regions.ts`. No runtime city allowlist exists.
- The Worker web app has a manifest, static-only service worker, safe-area CSS, and touch target rules. The service worker does not cache `/api` responses or uploaded media.

## Current production check

The current Worker is `trinque2` at `https://trinque2.chinonsoobeta.workers.dev`.

On 2026-07-21 its health endpoint returned `degraded`: D1, R2, and Places were configured, but OpenAI was unavailable because `OPENAI_API_KEY` was missing. This report contains no secret value. `GCP_API_KEY` is the current server-side Places secret; `GOOGLE_PLACES_API_KEY` is a legacy fallback only.

The live Worker still serves the prior English UI. It does not contain the language and safety changes in this working tree. Browser checks at 320, 390, and 412 CSS pixels found no horizontal overflow, and the mobile navigation appeared at 390 pixels. These are browser viewport checks, not physical iOS Safari or Android Chrome results.

Do not run a production migration from this report. First export or back up D1, apply the migration sequence to a preview D1 database, run smoke checks, then deploy the Worker. Record the deployed commit, migration result, and health response. Roll back the Worker to the prior known-good version if health or smoke checks fail. A schema rollback needs its own reviewed migration; do not delete production tables as a rollback action.

## Safety and data controls

The database now stores blocks, mutes, hidden dishes, reports, moderation actions, moderation state, and soft-deletion time. Authenticated users can submit rate-limited reports and block, mute, or hide content. Normal dish deletion is a soft deletion; hard deletion is explicit. The moderation queue requires a server-only comma-separated SHA-256 allowlist in `TRINQUE_ADMIN_IDENTITY_HASHES`.

The web UI now has a reason-based report form, report status, block, mute, hide, unblock, unmute, unhide, comment removal, owner dish controls, and an admin-only moderation queue. The iOS dish feed exposes report reasons, hide, mute, and a confirmed block action. Automated tests check the route and visible surface wiring. Live signed-in moderation, account deletion, privacy export, and R2 removal are still unmeasured.

## Group and mobile limits

Group ranking rejects unknown required dietary data. The server stores distance unit, dietary needs, and cuisine types, and the automated three-session authorization, vote, finalization, RSVP, and calendar tests pass. Web and iOS now show the same localized dietary choices. The owner-only finalization rule remains enforced. A real eligible provider candidate and a live multi-account journey are still unmeasured.

The PWA is built and exported locally. Safari on iOS and Chrome on Android have not been tested on physical supported devices. The iOS Expo export is not a TestFlight validation.

## Required evidence before a controlled pilot

- Set and verify `OPENAI_API_KEY`, `GCP_API_KEY`, D1 `DB`, R2 `UPLOADS`, and Supabase public configuration in the Worker. Configure the hashed moderator allowlist only if the moderation queue is enabled.
- Obtain recorded human native-language review for French, Spanish, German, Italian, and Portuguese. All six catalogues have exact key parity, non-empty values, and a full-catalogue English-fallback test, but automated review does not replace a human native reviewer.
- Complete group UI and iOS request/response parity, then run a live multi-account group plan with an eligible candidate, vote, finalization, RSVP, and calendar export.
- Test moderation actions, feed filtering, account deletion, privacy export, and R2 media deletion against a safe preview environment. Complete signed-in iOS auth before treating iOS safety actions as usable; the current iOS client still sends a guest token while social safety routes require an onboarded account.
- Run real-device auth and mobile browser flows on supported iOS and Android devices.
- Run preview migration and smoke checks, take a production backup/export, deploy, and record the rollback version.

The product remains **NO-GO**. The live Worker is behind this working tree, live OpenAI analysis is unavailable, signed-in iOS safety is blocked by the auth contract, human native review is not recorded, and the required live multi-account and physical-device journeys have not run.
