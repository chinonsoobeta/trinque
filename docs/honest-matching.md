# Honest nearby matching

Live matching reads reviewed, published dish records from D1 and normalized restaurant alternatives from the configured Places provider. The old deterministic catalog is exported only as `demoNearbyCatalog` and is not reachable from the live publication path.

## Ranking

The matcher combines canonical cuisine, ingredient and flavour concepts with a smaller reviewed-display-field signal, geographic distance, provenance quality, verification, freshness and community-confirmation count. Canonical concepts carry the largest semantic weight, so changing only UI language keeps ranking stable; an active user edit updates the corresponding canonical concept as `user_reviewed`. Dish records beyond the bounded live radius are removed rather than presented as “nearby.”

Unsupported countries and invalid coordinates are rejected before ranking. `seed_demo` and disputed records do not enter live results. Stale and unverified records receive materially lower quality and freshness scores.

## Result tiers

1. **Confirmed nearby dishes** require a recent availability confirmation (within 90 days) and community or restaurant verification.
2. **Community or inferred dish records** include unverified, historical, stale and otherwise unconfirmed records with their status visible.
3. **Restaurant-level alternatives** are provider places, not dish claims. They always use `dishName: null`, `currentAvailabilityConfirmed: false`, provider-place provenance and not-applicable verification. Their explanation explicitly says that no matching dish or current menu is claimed.

Every result includes distance, an explanation code and fallback explanation, provenance, verification, last-confirmed information, a dietary caveat and current-availability state. Web and iOS localize the explanation and status labels while preserving original restaurant and dish names.

Provider failures are returned separately from D1 dish results. Missing credentials or a live provider failure never causes seeded restaurants to appear in live tiers.
