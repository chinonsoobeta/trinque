import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
