import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, hiddenDishes, mutes } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const body = await request.json() as { action?: "block" | "mute" | "hide"; targetId?: string };
    const targetId = body.targetId?.trim() ?? "";
    if (!targetId || targetId.length > 160 || !body.action) return Response.json({ error: "invalid_safety_action" }, { status: 400 });
    const db = await getDb();
    if (body.action === "block") {
      if (targetId === identity.id) return Response.json({ error: "cannot_block_self" }, { status: 400 });
      await db.insert(blocks).values({ blockerId: identity.id, blockedId: targetId }).onConflictDoNothing();
    } else if (body.action === "mute") {
      if (targetId === identity.id) return Response.json({ error: "cannot_mute_self" }, { status: 400 });
      await db.insert(mutes).values({ muterId: identity.id, mutedId: targetId }).onConflictDoNothing();
    } else await db.insert(hiddenDishes).values({ userId: identity.id, dishId: targetId }).onConflictDoNothing();
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "safety_action_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action"); const targetId = url.searchParams.get("targetId")?.trim() ?? "";
    if (!targetId || !["block", "mute", "hide"].includes(action ?? "")) return Response.json({ error: "invalid_safety_action" }, { status: 400 });
    const db = await getDb();
    if (action === "block") await db.delete(blocks).where(and(eq(blocks.blockerId, identity.id), eq(blocks.blockedId, targetId)));
    else if (action === "mute") await db.delete(mutes).where(and(eq(mutes.muterId, identity.id), eq(mutes.mutedId, targetId)));
    else await db.delete(hiddenDishes).where(and(eq(hiddenDishes.userId, identity.id), eq(hiddenDishes.dishId, targetId)));
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "safety_action_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}
