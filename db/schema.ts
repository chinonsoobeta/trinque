import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authType: text("auth_type", { enum: ["guest", "chatgpt"] }).notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  guestTokenHash: text("guest_token_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_guest_token_hash_unique").on(table.guestTokenHash),
]);

export const saves = sqliteTable("saves", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dishId: integer("dish_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.userId, table.dishId] })]);

export const preferences = sqliteTable("preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dietary: text("dietary").notNull().default("Flexible"),
  avoid: text("avoid").notNull().default(""),
  budgetMax: integer("budget_max").notNull().default(40),
  radiusMinutes: integer("radius_minutes").notNull().default(25),
  language: text("language", { enum: ["en-CA", "en-US", "en-GB", "fr", "es"] }).notNull().default("en-CA"),
  theme: text("theme", { enum: ["system", "light", "dark"] }).notNull().default("system"),
  measurementSystem: text("measurement_system", { enum: ["metric", "imperial"] }).notNull().default("metric"),
  locationLatitude: real("location_latitude"),
  locationLongitude: real("location_longitude"),
  locationLocality: text("location_locality"),
  locationAdministrativeRegion: text("location_administrative_region"),
  locationCountryCode: text("location_country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }),
  locationTimeZone: text("location_time_zone"),
  locationCurrencyCode: text("location_currency_code"),
  locationLocale: text("location_locale"),
  locationUpdatedAt: text("location_updated_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const restaurants = sqliteTable("restaurants", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: ["google", "community"] }).notNull(),
  providerPlaceId: text("provider_place_id"),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  locality: text("locality").notNull(),
  administrativeRegion: text("administrative_region").notNull(),
  countryCode: text("country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }).notNull(),
  address: text("address").notNull(),
  currencyCode: text("currency_code", { enum: ["USD", "CAD", "MXN", "GBP", "EUR"] }).notNull(),
  recordSource: text("record_source", { enum: ["community_submitted"] }).notNull().default("community_submitted"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  providerUpdatedAt: text("provider_updated_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("restaurants_provider_place_unique").on(table.provider, table.providerPlaceId),
  index("restaurants_country_location_idx").on(table.countryCode, table.latitude, table.longitude),
]);

export const publishedDishes = sqliteTable("published_dishes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceMode: text("source_mode", { enum: ["live", "demo"] }).notNull(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  ingredients: text("ingredients").notNull(),
  dietary: text("dietary").notNull(),
  confidence: integer("confidence").notNull(),
  description: text("description").notNull(),
  imageKey: text("image_key"),
  restaurantId: text("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),
  contributorId: text("contributor_id").references(() => users.id, { onDelete: "set null" }),
  priceAmount: real("price_amount"),
  currencyCode: text("currency_code", { enum: ["USD", "CAD", "MXN", "GBP", "EUR"] }),
  priceKnowledge: text("price_knowledge", { enum: ["unknown", "exact", "approximate"] }).notNull().default("unknown"),
  provenance: text("provenance", { enum: ["ai_identified", "community_submitted", "restaurant_verified", "menu_imported", "seed_demo"] }).notNull().default("ai_identified"),
  verificationStatus: text("verification_status", { enum: ["unverified", "community_confirmed", "restaurant_verified", "stale", "disputed"] }).notNull().default("unverified"),
  availabilityKnowledge: text("availability_knowledge", { enum: ["unknown", "recently_confirmed", "historical"] }).notNull().default("unknown"),
  availabilityConfidence: integer("availability_confidence").notNull().default(0),
  lastConfirmedAt: text("last_confirmed_at"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  countryCode: text("country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }),
  language: text("language", { enum: ["en-CA", "en-US", "en-GB", "fr", "es"] }).notNull().default("en-CA"),
  originalName: text("original_name"),
  canonicalCuisine: text("canonical_cuisine"),
  canonicalIngredients: text("canonical_ingredients"),
  canonicalFlavours: text("canonical_flavours"),
  canonicalMetadataSource: text("canonical_metadata_source", { enum: ["user_reviewed", "ai_normalized"] }).notNull().default("user_reviewed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("published_dishes_restaurant_idx").on(table.restaurantId),
  index("published_dishes_country_location_idx").on(table.countryCode, table.latitude, table.longitude),
]);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  eventTime: text("event_time").notNull(),
  neighborhood: text("neighborhood").notNull(),
  budgetMax: integer("budget_max").notNull(),
  maxDistanceKm: integer("max_distance_km").notNull(),
  vegetarianRequired: integer("vegetarian_required").notNull().default(0),
  allergies: text("allergies").notNull().default("[]"),
  inviteCode: text("invite_code").notNull(),
  inviteExpiresAt: text("invite_expires_at"),
  inviteRevokedAt: text("invite_revoked_at"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locality: text("locality"),
  administrativeRegion: text("administrative_region"),
  countryCode: text("country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }),
  currencyCode: text("currency_code", { enum: ["USD", "CAD", "MXN", "GBP", "EUR"] }),
  timeZone: text("time_zone"),
  locale: text("locale"),
  displayLanguage: text("display_language", { enum: ["en-CA", "en-US", "en-GB", "fr", "es"] }).notNull().default("en-CA"),
  status: text("status", { enum: ["voting", "finalized"] }).notNull().default("voting"),
  selectedCandidateId: text("selected_candidate_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("groups_invite_code_unique").on(table.inviteCode)]);

export const groupMembers = sqliteTable("group_members", {
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "participant"] }).notNull(),
  language: text("language", { enum: ["en-CA", "en-US", "en-GB", "fr", "es"] }).notNull().default("en-CA"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.groupId, table.userId] }), index("group_members_user_idx").on(table.userId, table.joinedAt)]);

export const groupCandidates = sqliteTable("group_candidates", {
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id").notNull(),
  name: text("name").notNull(),
  restaurant: text("restaurant").notNull(),
  neighborhood: text("neighborhood").notNull(),
  distanceKm: integer("distance_km").notNull(),
  price: text("price").notNull(),
  image: text("image").notNull(),
  score: integer("score").notNull(),
  eligible: integer("eligible", { mode: "boolean" }).notNull(),
  explanation: text("explanation").notNull(),
  conflicts: text("conflicts").notNull().default("[]"),
  kind: text("kind", { enum: ["published_dish", "provider_restaurant", "seed_demo"] }).notNull().default("seed_demo"),
  restaurantId: text("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),
  providerPlaceId: text("provider_place_id"),
  priceAmount: real("price_amount"),
  currencyCode: text("currency_code", { enum: ["USD", "CAD", "MXN", "GBP", "EUR"] }),
  provenance: text("provenance"),
  verificationStatus: text("verification_status"),
  currentAvailabilityConfirmed: integer("current_availability_confirmed", { mode: "boolean" }).notNull().default(false),
  dietaryCaveat: text("dietary_caveat").notNull().default("Dietary details are unknown; confirm directly."),
}, (table) => [primaryKey({ columns: [table.groupId, table.candidateId] })]);

export const groupVotes = sqliteTable("group_votes", {
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.groupId, table.userId] })]);

export const groupRsvps = sqliteTable("group_rsvps", {
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["yes", "maybe", "no"] }).notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.groupId, table.userId] })]);
