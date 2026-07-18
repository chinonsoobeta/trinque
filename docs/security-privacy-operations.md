# Pilot security, privacy, and operations

This document describes implementation controls, not legal advice and not a claim of compliance.

## Usage budgets and rate limits

D1 stores atomic hourly counters for `analysis`, `places`, `publish`, `invite_join`, and `vote`. Global counters apply to every action; authenticated publishing, invite joining, and voting also receive member-scoped counters. Limits are configurable with the environment variables listed in the project readiness documentation. A rejected request returns `429`, a safe `rate_limit` code, a request ID, and `Retry-After`.

Counters contain an action, an opaque internal scope, the hourly window, and a count. They do not contain request bodies, images, authorization headers, locations, restaurant searches, or provider credentials. Old counter cleanup should be scheduled operationally once production volume justifies it.

## Logs and request IDs

Operational logging is JSON and allowlisted to timestamp, request ID, action, status, safe error code, duration, and country code where needed. Never add secrets, authorization headers, guest tokens, email addresses, uploaded image data, search text, exact coordinates, or provider payloads to logs. Incoming request IDs are accepted only in a bounded safe format; otherwise Trinque creates a UUID.

## Uploads and retention

PNG, JPEG, and WebP uploads are base64-decoded server-side, limited to 5 MB decoded, and checked against their file signatures. A declared MIME type alone is not trusted. Image retention is opt-in during publishing. Images are served `private, no-store` and can be removed independently, with the dish, or with all user data. If R2 deletion is unavailable, destructive database deletion stops and reports the failure rather than orphaning the image silently.

Deletion prevents future retrieval from Trinque storage. It cannot recall copies a user previously downloaded or copies cached before the `private, no-store` policy was introduced; this limitation must be stated in the reviewed privacy notice.

## User controls

Authenticated guest and trusted-header identities can:

- inspect and update location, analytics, and image-retention consent;
- withdraw every optional consent (which clears coarse location and retained images);
- export account, preferences, consent, saves, dish metadata, memberships, votes, RSVPs, and owned plan metadata without image bytes or storage keys;
- delete a retained image;
- delete a published dish and its retained image;
- delete all Trinque user data and retained images.

Consent-aware analytics events, bounded client diagnostics, and submitted feedback are included in the user export and deleted with the user identity. Analytics/diagnostic requests received without current analytics consent are acknowledged but not stored. Diagnostics retain only an error class, kind, platform, app version, and coarse route; they do not retain stack traces or payloads.

Database foreign keys cascade identity-owned records. Restaurants shared with other records retain provider/place facts while their `created_by_id` becomes null.

## CORS and providers

Wildcard CORS has been removed. Same-origin web calls need no cross-origin permission; native iOS networking is not governed by browser CORS. Explicit additional browser origins may be allowlisted with `TRINQUE_ALLOWED_ORIGINS`. Google and OpenAI credentials remain server-side. Provider errors use the safe taxonomy `credentials`, `quota`, `invalid_request`, `unavailable`, `timeout`, and `unreadable_response` where applicable.

## Credential rotation plan

If a credential has ever been pasted into a conversation, issue tracker, log, screenshot, shell history, or other uncontrolled surface:

1. Revoke or rotate it in the provider console immediately; do not wait for evidence of misuse.
2. Store the replacement only in the Sites/server secret manager under the documented environment-variable name.
3. Restrict the Google key to Places API (New), the intended server workload, and the minimum billing/project scope supported by Google.
4. Review provider usage and audit logs around the exposure window.
5. Remove exposed values from reachable artifacts where practical, while treating the old value as permanently compromised.
6. Validate production health without printing secret values.

## Professional-review questions

Professional privacy/legal review is still required for France/EU, the UK, Canada (including Québec), relevant US states, and Mexico. Review should determine controller/processor roles, lawful bases, age requirements, privacy-notice wording, consent granularity, analytics vendors, international transfers, retention periods, DSR identity verification and response timelines, breach processes, cookie/device-storage requirements, and whether restaurant/community contribution moderation creates additional obligations. Provider terms and EEA-specific Google Places requirements also require owner/provider review before a France pilot.
