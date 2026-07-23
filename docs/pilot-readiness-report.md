# Trinque pilot readiness report

Report date: 2026-07-23. Validated source: local commit `33642f1`. Recommendation: **NO-GO**.

## What passed locally

- `npm run lint` passes with no errors.
- `npm run verify` passes through the production build, all 108 web tests, iOS type check, and Expo export.
- `npm test` — 108 tests, 0 failures. Translation parity tests check all 6 languages for key parity, empty values, English fallback, technical terms, and provider codes.
- The clean D1 test applies migrations `0000` through `0013`. Social, group, onboarding, safety, and local group schedule data are verified.
- Region tests cover all 27 EU countries, GB, CA, US, MX, and an unsupported country. No runtime city allowlist exists.

## Phases 8–14 completed

| Phase | Summary |
|---|---|
| 8 — Group Planning | Group creation uses empty defaults, inline location search (web + iOS), 3-tier candidate display (fits/needs_checking/does_not_fit), human-readable reasons. Removed `vegetarianRequired` from API contract. No separate vegetarian guest section. |
| 9 — Localization | Hardcoded strings moved to i18n (timeAgo, Follow/Following, Loading, engagement labels). 9 new translation keys added across all 6 languages. Translation parity tests (5 checks) added. |
| 10 — PWA | Viewport meta with `viewport-fit=cover`, PNG icons (192+512), apple-touch-icon, offline fallback page, SW cache cleanup on activate. |
| 11 — iOS Parity | GroupsScreen parity (3-tier candidates, empty defaults, location search, invite dedup guard, `profile_incomplete` error handling), plus a notification sheet. Full comments, dish detail, owner controls, profile editing, and native date/time controls remain out of scope for this pass. |
| 12 — Tests | 108 tests pass (103 original + 5 translation). iOS type-checks pass. |
| 13 — Commits | 4 small commits: Phase 8 (group rebuild), Phase 9 (localization), Phase 10 (PWA), Phase 11–14 (final) |
| 14 — Preview Deploy | Preview live at `https://trinque2.chinonsoobeta.workers.dev` |

## Current production check

Current Worker preview: `https://trinque2.chinonsoobeta.workers.dev`. Health endpoint reports D1, R2, Places, and OpenAI status independently. `GOOGLE_PLACES_API_KEY` is supported as a legacy fallback; `GCP_API_KEY` is the current server-side Places secret.

## Safety and data controls

The database stores blocks, mutes, hidden dishes, reports, moderation actions, moderation state, and soft-deletion time. Authenticated users can submit rate-limited reports and block, mute, or hide content.

The web UI has a reason-based report form, report status, block, mute, hide, unblock, unmute, unhide, comment removal, owner dish controls, and an admin-only moderation queue. The iOS dish feed has the same safety controls. Automated tests check these contracts.

## Group planning

Group ranking rejects unknown required dietary data and allergens. The server stores distance unit, dietary needs, and cuisine types. Group candidates are organized into three tiers: fits, needs checking, does not fit. The automated three-session authorization, vote, finalization, RSVP, and calendar tests pass. Web and iOS show the same dietary choices and location search. owner-only finalization is enforced.

## Remaining limits

- Live multi-account group plan with an eligible provider candidate not yet measured
- Live moderation, account deletion, and privacy export not yet measured
- Human native-language review not yet recorded (automated parity checks pass)
- Physical iOS Safari and Android Chrome not yet tested. These are unmeasured.
- Real-time vote and RSVP state updates across multiple sessions are unmeasured.

## Required evidence before a controlled pilot

- Set and verify `OPENAI_API_KEY`, `GCP_API_KEY`, D1 `DB`, R2 `UPLOADS`, and Supabase public configuration in the Worker.
- Obtain recorded human native-language review for French, Spanish, German, Italian, and Portuguese.
- Run a live multi-account group plan with an eligible candidate, vote, finalization, RSVP, and calendar export.
- Test moderation actions, feed filtering, account deletion, privacy export, and R2 media deletion.
- Run real-device auth and mobile browser flows on supported iOS and Android devices.

The product remains **NO-GO**. The live Worker matches the tested source, but live OpenAI analysis, human native review, and multi-account/physical-device journeys are not yet measured.
