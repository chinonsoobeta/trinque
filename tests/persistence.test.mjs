import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("D1 migration creates guest identity and durable save tables", async () => {
  const sql = await readFile(new URL("../drizzle/0000_useful_maria_hill.sql", import.meta.url), "utf8");
  const publishSql = await readFile(new URL("../drizzle/0001_fair_the_hunter.sql", import.meta.url), "utf8");
  const groupSql = await readFile(new URL("../drizzle/0002_unusual_lady_mastermind.sql", import.meta.url), "utf8");
  const regionalPreferencesSql = await readFile(new URL("../drizzle/0003_unknown_mattie_franklin.sql", import.meta.url), "utf8");
  const dishGraphSql = await readFile(new URL("../drizzle/0004_wandering_marvex.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of publishSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of groupSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of regionalPreferencesSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of dishGraphSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);

  db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-1", "guest", "Guest explorer", "hash-1");
  db.prepare("INSERT INTO saves (user_id, dish_id) VALUES (?, ?)").run("guest-1", 2);
  db.prepare("INSERT INTO preferences (user_id) VALUES (?)").run("guest-1");
  db.prepare("INSERT INTO published_dishes (id, owner_id, source_mode, name, cuisine, ingredients, dietary, confidence, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("dish-1", "guest-1", "live", "Jollof rice", "West African", "rice tomato pepper", "Confirm stock", 92, "Smoky tomato rice");
  db.prepare("INSERT INTO restaurants (id, provider, provider_place_id, name, latitude, longitude, locality, administrative_region, country_code, address, currency_code, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("restaurant-1", "google", "ChIJRestaurant123", "Café Montréal", 45.5, -73.57, "Montréal", "QC", "CA", "10 rue Exemple", "CAD", "guest-1");
  db.prepare("UPDATE published_dishes SET restaurant_id = ?, contributor_id = ?, price_amount = ?, currency_code = ?, price_knowledge = ?, provenance = ?, verification_status = ?, availability_knowledge = ?, availability_confidence = ?, last_confirmed_at = ?, latitude = ?, longitude = ?, country_code = ?, language = ?, original_name = ? WHERE id = ?").run("restaurant-1", "guest-1", 24.5, "CAD", "exact", "ai_identified", "unverified", "recently_confirmed", 90, "2026-07-18T12:00:00.000Z", 45.5, -73.57, "CA", "fr", "Jollof rice", "dish-1");
  db.prepare("INSERT INTO groups (id, owner_id, name, event_time, neighborhood, budget_max, max_distance_km, vegetarian_required, allergies, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("group-1", "guest-1", "Friday supper", "2026-07-18T02:30:00.000Z", "Mount Pleasant", 35, 4, 1, "[\"sesame\"]", "invite123");
  db.prepare("INSERT INTO group_candidates (group_id, candidate_id, name, restaurant, neighborhood, distance_km, price, image, score, eligible, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("group-1", "oca-agnolotti", "Brown butter agnolotti", "Oca Pastificio", "Mount Pleasant", 0.8, "$24", "https://example.com/dish.jpg", 94, 1, "Within every constraint");
  db.prepare("INSERT INTO group_votes (group_id, user_id, candidate_id) VALUES (?, ?, ?)").run("group-1", "guest-1", "oca-agnolotti");
  db.prepare("INSERT INTO group_rsvps (group_id, user_id, status) VALUES (?, ?, ?)").run("group-1", "guest-1", "yes");

  const saved = db.prepare("SELECT dish_id FROM saves WHERE user_id = ?").get("guest-1");
  db.prepare("UPDATE preferences SET language = ?, theme = ?, measurement_system = ?, location_latitude = ?, location_longitude = ?, location_locality = ?, location_administrative_region = ?, location_country_code = ?, location_time_zone = ?, location_currency_code = ?, location_locale = ? WHERE user_id = ?").run("en-GB", "dark", "imperial", 51.51, -0.13, "London", "England", "GB", "Europe/London", "GBP", "en-GB", "guest-1");
  const preference = db.prepare("SELECT dietary, budget_max, language, theme, measurement_system, location_country_code FROM preferences WHERE user_id = ?").get("guest-1");
  assert.equal(saved.dish_id, 2);
  assert.equal(preference.dietary, "Flexible");
  assert.equal(preference.budget_max, 40);
  assert.equal(preference.language, "en-GB");
  assert.equal(preference.theme, "dark");
  assert.equal(preference.measurement_system, "imperial");
  assert.equal(preference.location_country_code, "GB");
  assert.equal(db.prepare("SELECT name FROM published_dishes WHERE owner_id = ?").get("guest-1").name, "Jollof rice");
  const graphDish = db.prepare("SELECT restaurant_id, provenance, verification_status, currency_code, availability_confidence FROM published_dishes WHERE id = ?").get("dish-1");
  assert.deepEqual({ ...graphDish }, { restaurant_id: "restaurant-1", provenance: "ai_identified", verification_status: "unverified", currency_code: "CAD", availability_confidence: 90 });
  assert.throws(() => db.prepare("INSERT INTO restaurants (id, provider, provider_place_id, name, latitude, longitude, locality, administrative_region, country_code, address, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("restaurant-2", "google", "ChIJRestaurant123", "Duplicate", 45.5, -73.57, "Montréal", "QC", "CA", "Other", "CAD"));
  assert.equal(db.prepare("SELECT candidate_id FROM group_votes WHERE group_id = ?").get("group-1").candidate_id, "oca-agnolotti");
  assert.equal(db.prepare("SELECT status FROM group_rsvps WHERE group_id = ?").get("group-1").status, "yes");
  assert.throws(() => db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-2", "guest", "Other guest", "hash-1"));
  db.close();
});
