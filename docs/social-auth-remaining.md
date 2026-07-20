# Social/auth integration status and follow-up checklist

This patch establishes the D1 session model, browser auth provider, public profiles, follows, likes, comments, feeds, notifications, authenticated saves, legacy mutation guards, targeted group invite notifications, R2-backed avatars, and authenticated social privacy/export/delete handling.

## Completed compatibility hardening

- Legacy dish/group mutations
  - `lib/identity.ts` now upgrades unsafe `/api/dishes/**` and `/api/groups/**` calls that still use either legacy `requireIdentity()` or guest-creating `getOrCreateIdentity()` helpers to require a non-guest authenticated account.
  - Public `GET`/`HEAD`/`OPTIONS` behavior remains guest-capable.
  - This preserves old handlers while preventing guest publishing, dish mutation, group creation/join/management/vote/finalize/RSVP writes.
  - Existing owner/member checks inside those legacy handlers remain authoritative; the shim only changes who may reach mutation logic.
- Group invites
  - `POST /api/groups/[id]/invite` lets a group owner target an authenticated profile handle.
  - It validates active invite state and writes a deduplicated `group_invite` notification keyed by group + invited user.
  - Notification targets use the existing group invite code so the current join flow remains compatible.
- Notifications UI
  - The delivery patch wires `NotificationBell` into the existing topbar; the component renders only for authenticated users.
- Avatar uploads
  - `POST/DELETE /api/profile/avatar` uses the existing Cloudflare runtime R2 binding rather than adding another storage provider.
  - Uploads are limited to JPEG/PNG/WebP/AVIF and 5 MB, stored under `avatars/<user>/...`, and served publicly through the same route.
  - Previous managed avatar objects are deleted on replacement/removal where possible.
- Privacy/account deletion
  - Authenticated users can export the new social/session/profile/group data through `/api/privacy/social`.
  - Account deletion removes attributable comments/social activity, owned dishes/groups, sessions/preferences/consents/diagnostics, clears R2 avatar data, and leaves a non-PII local tombstone.
  - `auth_subject_hash` + `deleted_at` prevent a still-valid Supabase or trusted ChatGPT credential from silently recreating the local account.
  - Existing guest privacy/export/delete behavior is left intact.

## iOS compatibility migration

The legacy `/api/session` route temporarily returns `guestToken` as an alias of the new app session token for authenticated Supabase users. The server stores that value only in `sessions.token_hash`, not `users.guest_token_hash`.

Migrate iOS in a follow-up release to:

1. Store the authenticated token as `sessionToken`.
2. Send `Authorization: Session <token>` for authenticated API calls.
3. Stop creating a guest database user merely to browse public feeds.
4. Treat `401` from saves/publish/groups/social mutations as an authentication prompt.
5. Continue allowing anonymous public feed/profile/comment reads.

After supported iOS versions have migrated, remove the authenticated `guestToken` response alias from `/api/session`.

## Deployment/configuration

- Apply `drizzle/0009_social_auth_foundation.sql` to D1 before deploying code that writes the new tables/columns.
- Keep `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured in the Cloudflare runtime. Do not expose a service-role key to the browser.
- Supabase Auth should enable Email/Password and Google providers as desired.
- Add every production/preview callback origin to Supabase redirect allow-lists with `/auth/callback`.
- The avatar route discovers and reuses the configured R2 bucket binding by preferring common image-binding names and then structurally detecting an R2 binding. If the deployment has multiple R2 buckets, set/use a preferred image binding name (`DISH_IMAGES`, `IMAGES`, `IMAGE_BUCKET`, `R2_BUCKET`, or `BUCKET`) so selection is deterministic.

## Feed notes

- Following feed: newest-first cursor using `(created_at, id)`.
- Trending feed: one SQL query; 24-hour engagement score = `3 * likes + 2 * comments + recency`, where recency decays linearly from `1` to `0` over 24 hours.
- Trending uses bounded offset pagination because ranking changes with live engagement; `Feed.tsx` de-duplicates dish ids across pages.
- Suggested people excludes the current user and already-followed users when authenticated, then ranks by `2 * follower_count + 3 * recent_30d_dish_count`.

## Still required after applying to the complete checkout

- Run `npm install`, `npm run lint`, and `npm run verify` in the complete repository. This stripped offline reconstruction does not contain the full application tree or installed dependencies, so a real web build and iOS Expo/TypeScript export cannot be executed here.
- Reconcile/generate `drizzle/meta/0009_snapshot.json` from the complete checkout so future `npm run db:generate` calls do not recreate the same schema changes. Preserve the custom backfill/token-migration/tombstone statements in `0009_social_auth_foundation.sql`.
- After supported iOS versions have migrated to `Session <token>`, remove the transitional authenticated `guestToken` alias and web local-storage compatibility copy.
