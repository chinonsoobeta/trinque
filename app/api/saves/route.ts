import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { saves } from "@/db/schema";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";
const cors = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const db = await getDb();
    const rows = await db.select({ dishId: saves.dishId }).from(saves).where(eq(saves.userId, identity.id)).orderBy(desc(saves.createdAt));
    return Response.json({ savedDishIds: rows.map((row) => row.dishId) }, { headers: cors });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to load saves." }, { status, headers: cors });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const body = await request.json() as { dishId?: number; saved?: boolean };
    if (!Number.isInteger(body.dishId) || Number(body.dishId) < 1) return Response.json({ error: "valid_dish_id_required", code: "valid_dish_id_required" }, { status: 400, headers: cors });
    const db = await getDb();
    if (body.saved === false) {
      await db.delete(saves).where(and(eq(saves.userId, identity.id), eq(saves.dishId, Number(body.dishId))));
    } else {
      await db.insert(saves).values({ userId: identity.id, dishId: Number(body.dishId) }).onConflictDoNothing();
    }
    return Response.json({ ok: true, dishId: Number(body.dishId), saved: body.saved !== false }, { headers: cors });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to update saves." }, { status, headers: cors });
  }
}
