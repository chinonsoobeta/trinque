import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authType: text("auth_type", { enum: ["guest", "chatgpt", "supabase"] }).notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  normalizedEmail: text("normalized_email"),
  authSubjectHash: text("auth_subject_hash"),
  deletedAt: text("deleted_at"),
  emailVerifiedAt: text("email_verified_at"),
  avatarUrl: text("avatar_url"),
  lastLoginAt: text("last_login_at"),
  guestTokenHash: text("guest_token_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
  uniqueIndex("users_auth_subject_hash_unique").on(table.authSubjectHash),
  uniqueIndex("users_guest_token_hash_unique").on(table.guestTokenHash),
]);


export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: text("last_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  userAgent: text("user_agent"),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
  index("sessions_expires_idx").on(table.expiresAt),
]);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull(),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  location: text("location"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("profiles_handle_unique").on(table.handle)]);

export const follows = sqliteTable("follows", {
  followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.followerId, table.followingId] }),
  check("follows_no_self", sql`${table.followerId} <> ${table.followingId}`),
  index("follows_following_created_idx").on(table.followingId, table.createdAt),
  index("follows_follower_created_idx").on(table.followerId, table.createdAt),
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

export const userConsents = sqliteTable("user_consents", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  locationConsent: integer("location_consent", { mode: "boolean" }).notNull().default(false),
  analyticsConsent: integer("analytics_consent", { mode: "boolean" }).notNull().default(false),
  imageRetentionConsent: integer("image_retention_consent", { mode: "boolean" }).notNull().default(false),
  consentedAt: text("consented_at"),
  withdrawnAt: text("withdrawn_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const usageCounters = sqliteTable("usage_counters", {
  action: text("action").notNull(),
  scope: text("scope").notNull(),
  windowStart: text("window_start").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.action, table.scope, table.windowStart] }), index("usage_counters_cleanup_idx").on(table.windowStart)]);

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  event: text("event", { enum: ["analysis_started", "analysis_completed", "analysis_failed", "analysis_corrected", "dish_published", "match_opened", "group_created", "invite_joined", "vote_cast", "plan_finalized", "rsvp_submitted"] }).notNull(),
  language: text("language", { enum: ["en-CA", "en-US", "en-GB", "fr", "es"] }),
  countryCode: text("country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }),
  mode: text("mode", { enum: ["live", "demo"] }),
  outcome: text("outcome"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("analytics_events_user_created_idx").on(table.userId, table.createdAt), index("analytics_events_event_created_idx").on(table.event, table.createdAt)]);

export const feedbackReports = sqliteTable("feedback_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["wrong_identification", "stale_dish", "closed_restaurant"] }).notNull(),
  targetType: text("target_type", { enum: ["analysis", "published_dish", "restaurant"] }).notNull(),
  targetId: text("target_id"),
  comment: text("comment"),
  countryCode: text("country_code", { enum: ["US", "CA", "MX", "GB", "FR"] }),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text("resolved_at"),
}, (table) => [index("feedback_reports_target_idx").on(table.targetType, table.targetId, table.createdAt), index("feedback_reports_status_idx").on(table.status, table.createdAt)]);

export const clientErrorReports = sqliteTable("client_error_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["js_exception", "unhandled_rejection", "api_error"] }).notNull(),
  code: text("code").notNull(),
  platform: text("platform", { enum: ["ios", "web"] }).notNull(),
  appVersion: text("app_version").notNull(),
  route: text("route"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("client_error_reports_user_created_idx").on(table.userId, table.createdAt)]);

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


export const likes = sqliteTable("likes", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dishId: text("dish_id").notNull().references(() => publishedDishes.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.dishId] }),
  index("likes_dish_created_idx").on(table.dishId, table.createdAt),
  index("likes_user_created_idx").on(table.userId, table.createdAt),
]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dishId: text("dish_id").notNull().references(() => publishedDishes.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("comments_dish_created_idx").on(table.dishId, table.createdAt),
  index("comments_user_created_idx").on(table.userId, table.createdAt),
]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type", { enum: ["like", "comment", "follow", "group_invite"] }).notNull(),
  targetId: text("target_id"),
  dedupeKey: text("dedupe_key").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("notifications_dedupe_unique").on(table.dedupeKey),
  index("notifications_user_unread_idx").on(table.userId, table.read, table.createdAt),
  index("notifications_user_recent_idx").on(table.userId, table.createdAt),
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
