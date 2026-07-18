# Trinque

Trinque is a dish-first social discovery app. Upload a food photo, let GPT-5.6 identify what makes the dish special, find similar options nearby, and coordinate a restaurant choice with friends.

## The demo

- Explore a visual feed of individual dishes instead of generic restaurant listings.
- Upload a dish photo for structured GPT-5.6 analysis.
- Review and correct every AI-generated field before publishing.
- See nearby taste matches with explanations, dietary caveats, price, and distance.
- Create a group plan that balances location, budget, allergies, vegetarian needs, and votes.
- Use the complete deterministic demo without an API key.

## Run locally

Requirements: Node.js 22.13 or newer.

    npm install
    npm run dev

Open http://localhost:3000.

### iOS app

The native Expo app lives in `ios/` so it can share this repository without changing the web deployment.

    cd ios
    npm install
    npm run ios

The app includes a deterministic photo-analysis demo. To connect it to the web app's server-side GPT analysis route, create `ios/.env.local` and set:

    EXPO_PUBLIC_TRINQUE_API_URL=http://localhost:3000

Use your Mac's local network address instead of `localhost` when testing on a physical iPhone. The OpenAI API key stays only in the web/server environment and is never shipped in the mobile bundle.

Guest sessions are created server-side and stored as an opaque token on the device. Profiles, preferences, and saved dishes are persisted in the platform D1 database; authenticated ChatGPT browser users are recognized from trusted hosting headers.

To enable live photo analysis, copy .env.example to .env.local and add an OpenAI API key. Never commit the key.

## GPT-5.6 integration

POST /api/analyze uses the OpenAI Responses API with gpt-5.6-sol, low reasoning effort, high-detail image input, and a strict JSON schema. The prompt explicitly treats ingredient and allergen inference as uncertain. A deterministic seed provider remains available through the separate labeled demo action so judges can still complete the experience without credentials.

Live and demo results are explicitly labeled. A failed or unconfigured live request never silently substitutes the demo dish: the API returns a structured error and the interface offers separate Retry and Use labeled demo actions.

## How Codex accelerated the build

Codex translated the product thesis into a working demo, shaped the PRD and technical architecture, implemented the responsive interface and server route, created the mock-provider fallback, generated the social preview, and verified the production build. Key product decisions—dish-first discovery, mandatory AI review, safety language, and the group-fit flow—remain visible in the implementation.

## Validation

    npm run build
    npm test

## Stack

Next.js, React, React Native, Expo, TypeScript, OpenAI Responses API, GPT-5.6 Sol, Codex, and the Sites deployment runtime.
