import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("D1 migration creates guest identity and durable save tables", async () => {
  const sql = await readFile(new URL("../drizzle/0000_useful_maria_hill.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);

  db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-1", "guest", "Guest explorer", "hash-1");
  db.prepare("INSERT INTO saves (user_id, dish_id) VALUES (?, ?)").run("guest-1", 2);
  db.prepare("INSERT INTO preferences (user_id) VALUES (?)").run("guest-1");

  const saved = db.prepare("SELECT dish_id FROM saves WHERE user_id = ?").get("guest-1");
  const preference = db.prepare("SELECT dietary, budget_max FROM preferences WHERE user_id = ?").get("guest-1");
  assert.equal(saved.dish_id, 2);
  assert.equal(preference.dietary, "Flexible");
  assert.equal(preference.budget_max, 40);
  assert.throws(() => db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)").run("guest-2", "guest", "Other guest", "hash-1"));
  db.close();
});
