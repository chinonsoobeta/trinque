import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

export async function getDb() {
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is unavailable. Set it (and TURSO_AUTH_TOKEN for remote libSQL databases) in the Vercel project environment before using the database."
    );
  }

  // Serverless instances are reused across invocations, so hold one client per
  // instance instead of opening a connection on every request.
  cached = drizzle(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() }), { schema });
  return cached;
}
