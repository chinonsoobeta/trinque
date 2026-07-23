import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../drizzle/", import.meta.url);

async function migrationFiles() {
  const names = (await readdir(root))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  return Promise.all(names.map(async (name) => ({
    name,
    tag: name.slice(0, -4),
    sql: await readFile(new URL(name, root), "utf8"),
  })));
}

function apply(db, sql) {
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

test("D1 migration journal and SQL files stay in lockstep", async () => {
  const files = await migrationFiles();
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", root), "utf8"));
  assert.deepEqual(journal.entries.map((entry) => entry.tag), files.map((file) => file.tag));
  assert.equal(journal.entries.length, files.length);
  assert.ok(files.length >= 14);
});

test("all migrations apply to a clean database and upgrade legacy rows", async () => {
  const files = await migrationFiles();
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  for (const file of files.slice(0, 8)) apply(db, file.sql);
  db.prepare("INSERT INTO users (id, auth_type, display_name, guest_token_hash) VALUES (?, ?, ?, ?)")
    .run("legacy-owner", "guest", "Legacy owner", "legacy-hash");
  db.prepare("INSERT INTO groups (id, owner_id, name, event_time, neighborhood, budget_max, max_distance_km, vegetarian_required, allergies, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("legacy-group", "legacy-owner", "Legacy plan", "2026-07-20T19:30:00.000Z", "Vancouver", 35, 4, 0, "[]", "legacy-invite", "2026-07-18T12:00:00.000Z");

  for (const file of files.slice(8)) apply(db, file.sql);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  for (const table of ["profiles", "sessions", "blocks", "mutes", "content_reports", "moderation_actions", "published_dishes", "groups"]) {
    assert.ok(tables.includes(table), `missing table ${table}`);
  }
  const group = db.prepare("SELECT owner_id, event_local_date, event_local_time, time_zone, distance_unit FROM groups WHERE id = ?").get("legacy-group");
  assert.equal(group.owner_id, "legacy-owner");
  assert.equal(group.event_local_date, null);
  assert.equal(group.event_local_time, null);
  assert.equal(group.time_zone, null);
  assert.equal(group.distance_unit, "metric");
  assert.equal(db.prepare("SELECT count(*) AS count FROM users WHERE id = ?").get("legacy-owner").count, 1);
  db.close();
});
