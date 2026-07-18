# Build and deployment notes

The web app deploys through Sites using `.openai/hosting.json`. D1 is bound as `DB`; R2 is bound as `UPLOADS`. Database migrations live in `drizzle/` and are applied in sequence by the hosting build.

Live image analysis uses the server-only Sites secret `OPENAI_API_KEY`; Google Places (New) uses the server-only Sites secret `GOOGLE_PLACES_API_KEY`. Both are configured outside source control. If the OpenAI key is removed, the application remains navigable through the explicitly labeled deterministic demo path while live analysis returns `live_not_configured`. If the Places key is absent, location search reports unavailable and never substitutes seeded Vancouver results.

The Expo iOS app uses the same API and durable guest token. Set `EXPO_PUBLIC_TRINQUE_API_URL` at iOS build time to the deployed Sites URL. Do not place the OpenAI key in Expo configuration or any client bundle.

Release gate:

    npm ci
    cd ios && npm ci && cd ..
    npm run verify

After the gate is green, commit and push the exact source state before packaging and saving a Sites version from that commit SHA.
