# Build and deployment notes

The web app deploys as Cloudflare Worker `trinque2` at `https://trinque2.chinonsoobeta.workers.dev`. D1 is bound as `DB`; R2 is bound as `UPLOADS`. Database migrations live in `drizzle/` and must be applied in sequence before the Worker deploy.

Live image analysis uses the server-only Worker secret `OPENAI_API_KEY`; Google Places uses the server-only Worker secret `GCP_API_KEY`. `GOOGLE_PLACES_API_KEY` is a legacy fallback only. Secrets stay outside source control. If OpenAI is unavailable, the app shows an explicit unavailable state. If Places is unavailable, location search shows an explicit unavailable state and never adds demo results.

The Expo iOS app uses the same API and durable session contract. Set `EXPO_PUBLIC_TRINQUE_API_URL` at iOS build time to the Worker URL. Do not place server secrets in Expo configuration or client code.

Release gate:

    npm ci
    cd ios && npm ci && cd ..
    npm run verify

After the gate is green, commit and push the exact source state before packaging and saving a Sites version from that commit SHA.
