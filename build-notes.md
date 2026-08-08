# Build and deployment notes

The web app deploys to Vercel as a stock Next.js application (`next build`, Node
serverless functions). Durable relational data lives in Turso/libSQL, reached
through `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Dish images and avatars live
in a private Supabase Storage bucket, reached with the server-only
`SUPABASE_SERVICE_ROLE_KEY`. Database migrations live in `drizzle/` and must be
applied in sequence before promoting a deployment:

    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate

Live image analysis uses the server-only `OPENAI_API_KEY_2`; Google Places uses
the server-only `GCP_API_KEY`. `OPENAI_API_KEY` and `GOOGLE_PLACES_API_KEY` are
legacy fallbacks only. Secrets stay outside source control and live as Vercel
project environment variables. If OpenAI is unavailable, the app shows an
explicit unavailable state. If Places is unavailable, location search shows an
explicit unavailable state and never adds demo results.

`proxy.ts` carries the request envelope: a request id on every request and
response, CORS limited to the deployment's own origin plus
`TRINQUE_ALLOWED_ORIGINS`, and one structured log line per request.

The Expo iOS app uses the same API and durable session contract. Set
`EXPO_PUBLIC_TRINQUE_API_URL` at iOS build time to the Vercel deployment URL. Do
not place server secrets in Expo configuration or client code.

Release gate:

    npm ci
    cd ios && npm ci && cd ..
    npm run verify

After the gate is green, commit and push the exact source state before promoting
the Vercel deployment built from that commit SHA.
