# Trinque UI modernization: Vercel handoff notes

This UI patch deliberately does **not** replace Trinque's database or object-storage architecture. Those migrations should be handled as deployment work so the consumer UI refactor does not silently alter data contracts or honesty semantics.

## Supabase authentication on Vercel

The existing browser auth flow remains intact. Configure these server-side Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Do not expose a Supabase service-role/private key to browser code. `/api/auth/config` intentionally returns only the project URL and publishable key used by `@supabase/supabase-js`.

In the Supabase dashboard, allow the deployed application's auth callback URL:

`https://<your-production-domain>/auth/callback`

Add preview/development callback origins only where they are intentionally supported. Password reset and OAuth already derive `/auth/callback` from the current application origin, and the `next` parameter is constrained to app-relative paths.

Missing Supabase configuration remains a graceful state: the client resolves to no configured Supabase client and auth actions surface `Authentication is not configured.` rather than requiring a private browser secret.

## Remaining Vercel migration blockers

### Database

`db/index.ts` currently imports `cloudflare:workers`, requires the `DB` binding, and initializes `drizzle-orm/d1`.

Before database-backed routes can run natively on Vercel, provide a Vercel-compatible database adapter and preserve the existing schema/query contracts. This patch does not attempt to convert D1 data or rewrite those routes.

### Dish image storage

`lib/uploads.ts` currently reads and writes the Cloudflare `UPLOADS` R2 binding. `/api/media/[key]` depends on that storage adapter.

Before retained dish images can work natively on Vercel, replace the storage implementation behind the existing `storeDishImage`, `getDishImage`, and `deleteDishImage` contract (for example with a Vercel-compatible object store). The UI continues to consume the existing `/api/media/<key>` URL contract.

### Build/runtime tooling

Current package scripts run through `vinext` and include Wrangler/Cloudflare tooling. Validate the target Vercel build command and runtime before cutover rather than deleting Cloudflare dependencies as part of the UI patch.

Several route handlers also declare `runtime = "edge"`. Audit each against the chosen Vercel runtime and the replacement database/storage clients during deployment migration.

## Suggested integration sequence

1. Apply this patch from the exact `main` revision it was generated against.
2. Run `npm ci`.
3. Run `npm run lint` and `npm run verify`.
4. Exercise auth with Supabase configured and unconfigured.
5. Validate 1440, 1024, 768, 390, and 320 pixel viewports.
6. Capture Discover desktop/mobile, auth, profile, dish detail, Groups, and Saved-empty screenshots from the running application.
