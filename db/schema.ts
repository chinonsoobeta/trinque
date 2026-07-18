import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

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
  status: text("status", { enum: ["voting", "finalized"] }).notNull().default("voting"),
  selectedCandidateId: text("selected_candidate_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("groups_invite_code_unique").on(table.inviteCode)]);

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
