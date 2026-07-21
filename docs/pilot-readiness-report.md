# Trinque pilot readiness report

Report date: 2026-07-21. Validated source: commit `945794c6d1a9a8fe7873976c74319b37754d45bb`. Recommendation: **NO-GO**.

## What passed locally

- `npm run lint` passed with no errors.
- `npm run verify` passes through the production build, web tests, iOS type check, and Expo export. The stricter language tests scan every React page and component, including iOS, for raw JSX copy and raw user-facing attributes.
- The clean D1 test applies migrations `0000` through `0013`. It checks social, group, onboarding, safety, and local group schedule data. `npx drizzle-kit check` also passes.
- Region tests cover all 27 EU countries, GB, CA, US, MX, and an unsupported country. The supported-country list is shared in `lib/regions.ts`. No runtime city allowlist exists.
- The Worker web app has a manifest, static-only service worker, safe-area CSS, and touch target rules. The service worker does not cache `/api` responses or uploaded media.

## Current production check

The current Worker is `trinque2` at `https://trinque2.chinonsoobeta.workers.dev`.

On 2026-07-21 its health endpoint returned `degraded`: D1, R2, and Places were configured, but OpenAI was unavailable because `OPENAI_API_KEY` was missing. This report contains no secret value. `GCP_API_KEY` is the current server-side Places secret; `GOOGLE_PLACES_API_KEY` is a legacy fallback only.

The production D1 database was exported to a private local backup before change. Additive migrations `0010` through `0013` then applied successfully. A read-only schema check confirmed the group requirement and local schedule fields, profile onboarding fields, editable dish fields, and safety tables. The check did not read user records. The Worker code was not changed during the database step. The Worker version before release is `10f4dec3-0c5e-43bc-8648-cfe58df235a0`.

The public Worker now runs version `dac6a62c-af21-465d-ad4d-ed5d87615606`. The same source is saved as managed Sites version 12 under owner-only access. A post-release check returned HTTP 200 for the root page, health route, public auth setup, and demo analysis. The rendered page showed the final plain-language copy. D1 `DB`, R2 `UPLOADS`, Images, Assets, Supabase public settings, and the existing Places secret remained bound after release.

Browser checks at 320, 390, and 412 CSS pixels found no horizontal overflow, and the mobile navigation appeared at 390 pixels. A post-release browser snapshot confirmed the new public page and controls. These are browser viewport checks, not physical iOS Safari or Android Chrome results.

The production backup, additive migration, managed Sites release, and public Worker release are complete. Roll back the Worker to version `10f4dec3-0c5e-43bc-8648-cfe58df235a0` if a later live check finds a release fault. A schema rollback needs its own reviewed migration; do not delete production tables as a rollback action.

## Safety and data controls

The database now stores blocks, mutes, hidden dishes, reports, moderation actions, moderation state, and soft-deletion time. Authenticated users can submit rate-limited reports and block, mute, or hide content. Normal dish deletion is a soft deletion; hard deletion is explicit. The moderation queue requires a server-only comma-separated SHA-256 allowlist in `TRINQUE_ADMIN_IDENTITY_HASHES`.

The web UI now has a reason-based report form, report status, block, mute, hide, unblock, unmute, unhide, comment removal, owner dish controls, and an admin-only moderation queue. The iOS dish feed has the same dish report reasons, optional report details, hide, mute, and confirmed block actions. Its safety screen lists reports and lets users undo block, mute, and hide choices. iOS now uses a signed-in app session and requires onboarding before social writes. Automated tests check these contracts. Live signed-in moderation, account deletion, privacy export, and R2 removal are still unmeasured.

## Group and mobile limits

Group ranking rejects unknown required dietary data. The server stores distance unit, dietary needs, and cuisine types, and the automated three-session authorization, vote, finalization, RSVP, and calendar tests pass. Web and iOS now show the same localized dietary choices. The owner-only finalization rule remains enforced. A real eligible provider candidate and a live multi-account journey are still unmeasured.

The PWA is built and exported locally. Safari on iOS and Chrome on Android have not been tested on physical supported devices. The iOS Expo export is not a TestFlight validation.

## Required evidence before a controlled pilot

- Set and verify `OPENAI_API_KEY`, `GCP_API_KEY`, D1 `DB`, R2 `UPLOADS`, and Supabase public configuration in the Worker. Configure the hashed moderator allowlist only if the moderation queue is enabled.
- Obtain recorded human native-language review for French, Spanish, German, Italian, and Portuguese. The automated review now checks exact key parity, empty values, English fallback, raw JSX and attributes across the full React tree, reviewed jargon and model names, and sentences over 24 words. German, Italian, and Portuguese no longer use English fallback entries. Necessary food labels such as Halal remain unchanged. Automated review does not replace a human native reviewer.
- Run a live multi-account group plan with an eligible candidate, vote, finalization, RSVP, and calendar export. Source and contract parity checks pass, but this live journey is not measured.
- Test moderation actions, feed filtering, account deletion, privacy export, R2 media deletion, and the new signed-in iOS safety flow against a safe preview environment.
- Run real-device auth and mobile browser flows on supported iOS and Android devices.

The product remains **NO-GO**. The live Worker matches the tested source, but live OpenAI analysis is unavailable, human native review is not recorded, and the required signed-in multi-account and physical-device journeys have not run.
