# iOS release readiness

The iOS app has committed EAS `preview` and `production` profiles in [ios/eas.json](/Users/chinonsoobeta/trinque/ios/eas.json). Both profiles inject only the public production API URL and universal-link host; OpenAI, Google Places, D1, R2, and any crash-reporting credentials remain server-side. EAS environments should be populated and reviewed with `eas env:list --environment preview` and `eas env:list --environment production`; do not commit `.env.local` or secret values.

## Universal links and invites

The existing `trinque://join/<code>` deep link remains supported. The app config also declares `applinks:<production-host>`, and `GET /.well-known/apple-app-site-association` emits the association for `com.chinonsoobeta.trinque` once `APPLE_DEVELOPER_TEAM_ID` is configured server-side. Apple must be able to fetch that endpoint over HTTPS, so the current owner-only Sites access policy is a blocker until the owner provides an approved public association/API surface or an authenticated distribution design. No access policy was changed.

## Diagnostics

iOS JS exceptions are reported only as consent-gated, bounded metadata: error kind, sanitized error class, platform, app version, and a coarse app route. No stack, image, token, email, coordinates, search text, or request body is sent. These records are exportable and cascade on account deletion. Native crash symbolication still requires an owner-selected provider account and build-time source-map credentials; the current implementation is provider-neutral and does not invent a Sentry project or token.

## Physical-device/TestFlight checklist

The local iOS type check and Expo export pass. The dish feed now shows localized report reasons, hide, mute, and block controls. These actions are not pilot-ready because the current native client sends a guest token and the safety API correctly requires a signed-in, onboarded account. Add the supported account session to iOS and test it before marking any native safety item complete.

- [ ] Owner configures the production EAS environment with the deployed API URL and universal-link host.
- [ ] Owner configures `APPLE_DEVELOPER_TEAM_ID` and verifies the AASA endpoint from an unauthenticated HTTPS client.
- [ ] Owner confirms the production API is reachable from an iOS device under the approved Sites access policy; the current owner-only policy will fail this until resolved.
- [ ] Build and install the preview profile on a physical iPhone.
- [ ] Verify location permission allow/deny, manual fallback, coarse persistence, country formatting, and settings changes.
- [ ] Verify live/demo/unavailable analysis states, review correction, publish consent, nearby tiers, feedback, deletion, and export.
- [ ] Verify two additional guest sessions join a group invite, vote independently, finalize, RSVP, and export a local-time calendar event.
- [ ] Verify `trinque://join/<code>` and the HTTPS universal link on a device.
- [ ] Confirm crash/diagnostic records contain only the documented safe fields and that withdrawal stops new records.
- [ ] Run `eas build --profile production --platform ios` and distribute through TestFlight only after the owner approves the external action.

The current release recommendation is **NO-GO** until the production API/universal-link access design and Apple team identity are supplied. This is an access/credential blocker, not a code or build failure.
