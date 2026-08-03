// One-off: load a `wrangler d1 export` dump into the libSQL/Turso database in
// TURSO_DATABASE_URL. Kept in the repo so the Cloudflare cutover is repeatable
// and auditable rather than a sequence of untracked shell commands.
//
//   npx wrangler d1 export trinque --remote --output d1-export.sql
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/restore-from-d1.mjs d1-export.sql
//
// Run this against an empty database.
//
// The live D1 schema is AHEAD of this repository's migrations: it has eleven
// tables the migrations never create (sessions, profiles, follows, likes,
// comments, notifications, blocks, mutes, hidden_dishes, content_reports,
// moderation_actions) and six extra `users` columns (normalized_email,
// auth_subject_hash, deleted_at, email_verified_at, avatar_url, last_login_at),
// all added out-of-band by work that was never committed here.
//
// So the dump is restored verbatim - production is the source of truth for
// production data, and silently dropping columns or rows is not this script's
// decision to make. Drizzle's migration journal is then seeded to mark 0000-0008
// as applied, so a later `npm run db:migrate` adds only new migrations instead
// of replaying old ones against tables that already exist.
import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const [dumpPath] = process.argv.slice(2);
const url = process.env.TURSO_DATABASE_URL?.trim();

if (!dumpPath || !url) {
  console.error("Usage: TURSO_DATABASE_URL=... node scripts/restore-from-d1.mjs <dump.sql>");
  process.exit(1);
}

const sql = await readFile(dumpPath, "utf8");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });

// D1 dumps are one statement per line for DDL and inserts, but PRAGMA and
// transaction control must not be replayed against libSQL.
const statements = sql
  .split(/;\s*$/m)
  .map((statement) => statement.trim())
  .filter(Boolean)
  .filter((statement) => !/^(PRAGMA|BEGIN|COMMIT|END)\b/i.test(statement));

// A D1 dump is not ordered by foreign-key dependency (`preferences` is emitted
// before `users`), so create every table first and load rows with enforcement
// deferred, then check referential integrity once at the end.
const isDdl = (statement) => /^CREATE\b/i.test(statement);
const ordered = [...statements.filter(isDdl), ...statements.filter((statement) => !isDdl(statement))];

await client.execute("PRAGMA foreign_keys = OFF");

let applied = 0;
let skipped = 0;
for (const statement of ordered) {
  try {
    await client.execute(statement);
    applied += 1;
  } catch (error) {
    if (isDdl(statement) && /already exists/i.test(error.message ?? "")) {
      skipped += 1;
      continue;
    }
    console.error(`Failed: ${statement.slice(0, 120)}`);
    throw error;
  }
}

// Mark the committed migrations as already applied. The hashes are taken from a
// throwaway database that drizzle migrates itself, rather than recomputed here,
// so they always match whatever drizzle expects.
const scratchPath = `${tmpdir()}/trinque-journal-${randomUUID()}.db`;
const scratch = createClient({ url: `file:${scratchPath}` });
try {
  await migrate(drizzle(scratch), { migrationsFolder: "./drizzle" });
  const journal = await scratch.execute("SELECT hash, created_at FROM __drizzle_migrations ORDER BY id");
  await client.execute("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)");
  for (const row of journal.rows) {
    await client.execute({ sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", args: [row.hash, row.created_at] });
  }
  var journalEntries = journal.rows.length;
} finally {
  scratch.close();
  await rm(scratchPath, { force: true });
}

const violations = await client.execute("PRAGMA foreign_key_check");
if (violations.rows.length > 0) {
  client.close();
  console.error(`Restore left ${violations.rows.length} foreign-key violation(s):`, violations.rows.slice(0, 10));
  process.exit(1);
}
await client.execute("PRAGMA foreign_keys = ON");

const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
const counts = {};
for (const row of tables.rows) {
  const result = await client.execute(`SELECT COUNT(*) AS n FROM "${row.name}"`);
  counts[row.name] = Number(result.rows[0].n);
}

client.close();
console.info(JSON.stringify({ event: "d1_restore_complete", applied, skippedExistingDdl: skipped, journalEntries, counts }, null, 2));
