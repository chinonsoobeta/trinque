/**
 * Applies the Drizzle migrations in `drizzle/` to the libSQL database named by
 * TURSO_DATABASE_URL. Run it before promoting a deployment that adds tables.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL is required.");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
client.close();
console.log(`Migrations applied to ${url.replace(/\/\/.*@/, "//")}`);
