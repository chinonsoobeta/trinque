import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("D1 migration creates guest identity and durable save tables", async () => {
  const sql = await readFile(new URL("../drizzle/0000_useful_maria_hill.sql", import.meta.url), "utf8");
  const publishSql = await readFile(new URL("../drizzle/0001_fair_the_hunter.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  for (const statement of publishSql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);

  db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-1", "guest", "Guest explorer", "hash-1");
  db.prepare("INSERT INTO saves (user_id, dish_id) VALUES (?, ?)").run("guest-1", 2);
  db.prepare("INSERT INTO preferences (user_id) VALUES (?)").run("guest-1");
  db.prepare("INSERT INTO published_dishes (id, owner_id, source_mode, name, cuisine, ingredients, dietary, confidence, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("dish-1", "guest-1", "live", "Jollof rice", "West African", "rice tomato pepper", "Confirm stock", 92, "Smoky tomato rice");

  const saved = db.prepare("SELECT dish_id FROM saves WHERE user_id = ?").get("guest-1");
  const preference = db.prepare("SELECT dietary, budget_max FROM preferences WHERE user_id = ?").get("guest-1");
  assert.equal(saved.dish_id, 2);
  assert.equal(preference.dietary, "Flexible");
  assert.equal(preference.budget_max, 40);
  assert.equal(db.prepare("SELECT name FROM published_dishes WHERE owner_id = ?").get("guest-1").name, "Jollof rice");
  assert.throws(() => db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-2", "guest", "Other guest", "hash-1"));
  db.close();
});
