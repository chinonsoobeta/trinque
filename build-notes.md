# Build and deployment notes

The web app deploys to Vercel as a stock Next.js application (`next build`). Durable relational data lives in a Turso (libSQL) database reached through `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; uploaded image bytes live in a private Supabase Storage bucket reached through `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Database migrations live in `drizzle/` and are **not** applied by the build. Apply them deliberately, against the environment you intend to change:

    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate

Live image analysis uses the server-only environment variable `OPENAI_API_KEY`; Google Places (New) uses the server-only `GOOGLE_PLACES_API_KEY`. Both are configured in the Vercel project, outside source control. If the OpenAI key is removed, the application remains navigable through the explicitly labeled deterministic demo path while live analysis returns `live_not_configured`. If the Places key is absent, location search reports unavailable and never substitutes seeded Vancouver results.

The Expo iOS app uses the same API and durable guest token. Set `EXPO_PUBLIC_TRINQUE_API_URL` at iOS build time to the deployed Vercel URL. Do not place the OpenAI key in Expo configuration or any client bundle.

Release gate:

    npm ci
    cd ios && npm ci && cd ..
    npm run verify

After the gate is green, commit and push the exact source state; Vercel builds and promotes from that commit SHA.
