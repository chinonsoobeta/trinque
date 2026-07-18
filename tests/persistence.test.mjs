import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("D1 migration creates guest identity and durable save tables", async () => {
  const sql = await readFile(new URL("../drizzle/0000_useful_maria_hill.sql", import.meta.url), "utf8");
  const publishSql = await readFile(new URL("../drizzle/0001_fair_the_hunter.sql", import.meta.url), "utf8");
  const groupSql = await readFile(new URL("../drizzle/0002_unusual_lady_mastermind.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of publishSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of groupSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);

  db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-1", "guest", "Guest explorer", "hash-1");
  db.prepare("INSERT INTO saves (user_id, dish_id) VALUES (?, ?)").run("guest-1", 2);
  db.prepare("INSERT INTO preferences (user_id) VALUES (?)").run("guest-1");
  db.prepare("INSERT INTO published_dishes (id, owner_id, source_mode, name, cuisine, ingredients, dietary, confidence, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("dish-1", "guest-1", "live", "Jollof rice", "West African", "rice tomato pepper", "Confirm stock", 92, "Smoky tomato rice");
  db.prepare("INSERT INTO groups (id, owner_id, name, event_time, neighborhood, budget_max, max_distance_km, vegetarian_required, allergies, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("group-1", "guest-1", "Friday supper", "2026-07-18T02:30:00.000Z", "Mount Pleasant", 35, 4, 1, "[\"sesame\"]", "invite123");
  db.prepare("INSERT INTO group_candidates (group_id, candidate_id, name, restaurant, neighborhood, distance_km, price, image, score, eligible, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("group-1", "oca-agnolotti", "Brown butter agnolotti", "Oca Pastificio", "Mount Pleasant", 0.8, "$24", "https://example.com/dish.jpg", 94, 1, "Within every constraint");
  db.prepare("INSERT INTO group_votes (group_id, user_id, candidate_id) VALUES (?, ?, ?)").run("group-1", "guest-1", "oca-agnolotti");
  db.prepare("INSERT INTO group_rsvps (group_id, user_id, status) VALUES (?, ?, ?)").run("group-1", "guest-1", "yes");

  const saved = db.prepare("SELECT dish_id FROM saves WHERE user_id = ?").get("guest-1");
  const preference = db.prepare("SELECT dietary, budget_max FROM preferences WHERE user_id = ?").get("guest-1");
  assert.equal(saved.dish_id, 2);
  assert.equal(preference.dietary, "Flexible");
  assert.equal(preference.budget_max, 40);
  assert.equal(db.prepare("SELECT name FROM published_dishes WHERE owner_id = ?").get("guest-1").name, "Jollof rice");
  assert.equal(db.prepare("SELECT candidate_id FROM group_votes WHERE group_id = ?").get("group-1").candidate_id, "oca-agnolotti");
  assert.equal(db.prepare("SELECT status FROM group_rsvps WHERE group_id = ?").get("group-1").status, "yes");
  assert.throws(() => db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-2", "guest", "Other guest", "hash-1"));
  db.close();
});
