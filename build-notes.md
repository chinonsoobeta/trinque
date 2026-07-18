# Build and deployment notes

The web app deploys through Sites using `.openai/hosting.json`. D1 is bound as `DB`; R2 is bound as `UPLOADS`. Database migrations live in `drizzle/` and are applied in sequence by the hosting build.

Live image analysis requires the server-only Sites secret `OPENAI_API_KEY`. Without it, the application remains fully navigable through the explicitly labeled deterministic demo path, while live analysis returns `live_not_configured`. This is intentional fail-closed behavior, not an identifier fallback.

The Expo iOS app uses the same API and durable guest token. Set `EXPO_PUBLIC_TRINQUE_API_URL` at iOS build time to the deployed Sites URL. Do not place the OpenAI key in Expo configuration or any client bundle.

Release gate:

    npm ci
    cd ios && npm ci && cd ..
    npm run verify

After the gate is green, commit and push the exact source state before packaging and saving a Sites version from that commit SHA.
