// Applies the drizzle migrations in ./drizzle to the configured libSQL/Turso
// database. Cloudflare's control plane used to run these; on Vercel they are
// ours to run, so this is a deliberate step rather than a build hook.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL is unset.");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();
console.info(JSON.stringify({ event: "migrations_applied", target: url.replace(/\?.*$/, "") }));
