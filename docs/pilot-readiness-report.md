# Trinque pilot readiness report

Report date: 2026-07-21. Validated source: `main` commit `6a680f4`. Recommendation: **NO-GO**.

## What passed locally

- `npm run lint` passed with no errors.
- `npm run verify` passed: 86 web tests, production web build, iOS type check, and iOS Expo export.
- The clean D1 test applies migrations `0000` through `0012`. It checks the social, group, onboarding, and safety tables.
- Region tests cover all 27 EU countries, GB, CA, US, MX, and an unsupported country. The supported-country list is shared in `lib/regions.ts`. No runtime city allowlist exists.
- The Worker web app has a manifest, static-only service worker, safe-area CSS, and touch target rules. The service worker does not cache `/api` responses or uploaded media.

## Current production check

The current Worker is `trinque2` at `https://trinque2.chinonsoobeta.workers.dev`.

On 2026-07-21 its health endpoint returned `degraded`: D1, R2, and Places were configured, but OpenAI was unavailable because `OPENAI_API_KEY` was missing. This report contains no secret value. `GCP_API_KEY` is the current server-side Places secret; `GOOGLE_PLACES_API_KEY` is a legacy fallback only.

Do not run a production migration from this report. First export or back up D1, apply the migration sequence to a preview D1 database, run smoke checks, then deploy the Worker. Record the deployed commit, migration result, and health response. Roll back the Worker to the prior known-good version if health or smoke checks fail. A schema rollback needs its own reviewed migration; do not delete production tables as a rollback action.

## Safety and data controls

The database now stores blocks, mutes, hidden dishes, reports, moderation actions, moderation state, and soft-deletion time. Authenticated users can submit rate-limited reports and block, mute, or hide content. Normal dish deletion is a soft deletion; hard deletion is explicit. The moderation queue requires a server-only comma-separated SHA-256 allowlist in `TRINQUE_ADMIN_IDENTITY_HASHES`.

This is not yet complete pilot evidence. The web and iOS surfaces do not yet expose all safety actions, and feeds do not yet apply every block, mute, and hide rule. The report and moderation routes need route-level authorization and abuse tests beyond the schema migration test.

## Group and mobile limits

Group ranking rejects unknown required dietary data. The server stores distance unit, dietary needs, and cuisine types, and the existing automated three-session authorization, vote, finalization, RSVP, and calendar tests pass. The owner-only finalization rule remains enforced. The web and iOS form contracts still need full UI parity, real provider candidate proof, and physical-device flows.

The PWA is built and exported locally. Safari on iOS and Chrome on Android have not been tested on physical supported devices. The iOS Expo export is not a TestFlight validation.

## Required evidence before a controlled pilot

- Set and verify `OPENAI_API_KEY`, `GCP_API_KEY`, D1 `DB`, R2 `UPLOADS`, and Supabase public configuration in the Worker. Configure the hashed moderator allowlist only if the moderation queue is enabled.
- Complete native review and removal of English fallback copy for French, Spanish, German, Italian, and Portuguese.
- Complete group UI and iOS request/response parity, then run a live multi-account group plan with an eligible candidate, vote, finalization, RSVP, and calendar export.
- Complete report, block, mute, hide, and owner controls in web and iOS UI. Test moderation actions, feed filtering, account deletion, privacy export, and R2 media deletion against a safe preview environment.
- Run real-device auth and mobile browser flows on supported iOS and Android devices.
- Run preview migration and smoke checks, take a production backup/export, deploy, and record the rollback version.

The product remains **NO-GO**. Automated checks are useful, but the missing live credentials, incomplete native translation work, incomplete UI parity, and unmeasured production journeys block a controlled pilot.
