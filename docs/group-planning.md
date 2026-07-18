# Multi-user group planning

Phase 5 replaces the prototype invite display with membership-authorized group plans backed by D1.

## Identity and access

- Every plan has an `owner` membership and may have independent `participant` memberships.
- Reading a plan, voting, RSVP submission, and calendar download require membership.
- Only the owner may finalize an eligible candidate or revoke an invite.
- Invite codes expire after seven days and can be revoked. Joining is idempotent for an existing member and persists that member's UI language separately.
- Votes and RSVPs use `(group_id, user_id)` primary keys with atomic upserts, so one member cannot overwrite another member's choice.

## Candidates and honesty

New plans are built from nearby published dish records in D1 and, when configured, Google restaurant-level alternatives. Demo restaurants are never substituted into a live plan. Restaurant-level alternatives remain ineligible when price, dietary fit, allergens, or menu availability cannot be supported; the UI says that no matching dish is claimed.

## Regional plan data

Plans persist their normalized location, country, currency, time zone, formatting locale, and display language. Clients submit a local calendar date and wall time; the server resolves that time in the group location's IANA time zone. Calendar exports use `DTSTART;TZID` and `DTEND;TZID`, so the selected restaurant and local plan time do not depend on a participant's device zone.

## Invite journeys

- Web: `/?join=<code>` opens the Groups journey and joins after a guest session is available.
- iOS: the registered `trinque://join/<code>` scheme opens the Groups journey and joins with the current independent guest identity.
- Universal-link association remains a release-readiness task because it requires the final production domain and Apple association file.

## Credential-dependent behavior

Without `GOOGLE_PLACES_API_KEY`, group creation still uses eligible nearby published D1 dishes. Provider health remains unavailable and no seeded Vancouver or other demo results are inserted. A real three-session route smoke test and real provider candidate check require deployed D1/Places configuration.
