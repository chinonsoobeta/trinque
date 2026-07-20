import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const db = await getDb();
    const [row] = await db.select({ count: count() }).from(notifications).where(and(eq(notifications.userId, identity.id), eq(notifications.read, false)));
    return Response.json({ count: row?.count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to load notification count." }, { status });
  }
}
