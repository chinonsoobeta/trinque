# Location-aware dish graph

Phase 3 introduces normalized `restaurants` and connects every newly published dish to both a contributor and a restaurant. Existing records remain readable during migration, while the publication API enforces the richer contract for all new records.

## Record meaning

- A **restaurant** is a contributor-confirmed place snapshot. Google-backed records retain the stable place ID and only the normalized fields the contributor reviewed. Community entries carry no provider place ID.
- A **dish** preserves its submitted name and display-language analysis alongside language-stable canonical matching concepts.
- **Provenance** describes how the dish record originated: `ai_identified`, `community_submitted`, `restaurant_verified`, `menu_imported`, or `seed_demo`.
- **Verification** is independent of provenance: `unverified`, `community_confirmed`, `restaurant_verified`, `stale`, or `disputed`.
- **Availability knowledge** is explicitly `unknown`, `recently_confirmed`, or `historical`. A restaurant association does not itself establish current availability.

## Publication guardrails

Publishing requires the contributor to review the analysis, select or enter a real restaurant, state their price knowledge, state their availability knowledge, and confirm the restaurant association. The server derives provenance and verification; client input cannot elevate an AI identification to restaurant-verified status. Demo analysis always persists as `seed_demo`.

Google place IDs are stored as provider identifiers. Trinque does not store raw Google responses or use provider results as an automated restaurant cache. Normalized restaurant fields are persisted only after an active contributor confirms the association. Provider attribution remains visible during selection.

Canonical cuisine, ingredient, and flavour concepts are stored separately from display language so a language change does not rewrite the underlying matching identity. AI-normalized canonical metadata is visibly described as such and never replaces allergen uncertainty.
