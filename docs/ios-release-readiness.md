# iOS release readiness

The iOS app has committed EAS `preview` and `production` profiles in [ios/eas.json](/Users/chinonsoobeta/trinque/ios/eas.json). Both profiles inject only the public production API URL and universal-link host; OpenAI, Google Places, D1, R2, and any crash-reporting credentials remain server-side. EAS environments should be populated and reviewed with `eas env:list --environment preview` and `eas env:list --environment production`; do not commit `.env.local` or secret values.

## Universal links and invites

The existing `trinque://join/<code>` deep link remains supported. The app config also declares `applinks:<production-host>`, and `GET /.well-known/apple-app-site-association` emits the association for `com.chinonsoobeta.trinque` once `APPLE_DEVELOPER_TEAM_ID` is configured server-side. The public Worker is reachable without the owner-only managed Sites access policy. `APPLE_DEVELOPER_TEAM_ID` and a physical universal-link check remain required.

## Diagnostics

iOS JS exceptions are reported only as consent-gated, bounded metadata: error kind, sanitized error class, platform, app version, and a coarse app route. No stack, image, token, email, coordinates, search text, or request body is sent. These records are exportable and cascade on account deletion. Native crash symbolication still requires an owner-selected provider account and build-time source-map credentials; the current implementation is provider-neutral and does not invent a Sentry project or token.

## Physical-device/TestFlight checklist

The local iOS type check and Expo export pass. The native app can now create an account or sign in with email and password through the public Supabase setup returned by the Worker. It exchanges the Supabase access token for a Trinque app session, stores that app session in AsyncStorage, restores it at launch, and sends `Session` authorization for signed-in privacy and safety calls. New accounts must complete name, username, country, and language setup before social writes. The dish feed includes report reasons, optional report details, hide, mute, and confirmed block controls. The profile screen lists reports and lets the user undo block, mute, and hide choices.

These source and build checks do not prove that production Supabase settings, email delivery, or device key storage work. Run the sign-in, account creation, onboarding, safety, sign-out, relaunch, and deletion flows on a physical device before release.

- [ ] Owner configures the production EAS environment with the deployed API URL and universal-link host.
- [ ] Owner configures `APPLE_DEVELOPER_TEAM_ID` and verifies the AASA endpoint from an unauthenticated HTTPS client.
- [ ] Owner confirms the public Worker API is reachable from a physical iOS device.
- [ ] Build and install the preview profile on a physical iPhone.
- [ ] Verify location permission allow/deny, manual fallback, coarse persistence, country formatting, and settings changes.
- [ ] Verify live/demo/unavailable analysis states, review correction, publish consent, nearby tiers, feedback, deletion, and export.
- [ ] Create an account, complete onboarding, sign out, sign in, close and reopen the app, and confirm that the app session restores.
- [ ] Report a dish with details, hide it, mute and block its owner, then undo each choice in the safety screen.
- [ ] Verify two additional guest sessions join a group invite, vote independently, finalize, RSVP, and export a local-time calendar event.
- [ ] Verify `trinque://join/<code>` and the HTTPS universal link on a device.
- [ ] Confirm crash/diagnostic records contain only the documented safe fields and that withdrawal stops new records.
- [ ] Run `eas build --profile production --platform ios` and distribute through TestFlight only after the owner approves the external action.

The current release recommendation is **NO-GO** until the Apple team identity, universal link, and physical-device flows are verified. The public API is deployed; these are device-evidence blockers, not local build failures.
