import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, follows, hiddenDishes, mutes, notifications, profiles, publishedDishes } from "@/db/schema";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const db = await getDb();
    const [blockedRows, mutedRows, hiddenRows] = await Promise.all([
      db.select().from(blocks).where(eq(blocks.blockerId, identity.id)),
      db.select().from(mutes).where(eq(mutes.muterId, identity.id)),
      db.select().from(hiddenDishes).where(eq(hiddenDishes.userId, identity.id)),
    ]);
    const userIds = [...new Set([...blockedRows.map((row) => row.blockedId), ...mutedRows.map((row) => row.mutedId)])];
    const dishIds = hiddenRows.map((row) => row.dishId);
    const [profileRows, dishRows] = await Promise.all([
      userIds.length ? db.select({ id: profiles.userId, label: profiles.displayName, handle: profiles.handle }).from(profiles).where(inArray(profiles.userId, userIds)) : [],
      dishIds.length ? db.select({ id: publishedDishes.id, label: publishedDishes.name }).from(publishedDishes).where(inArray(publishedDishes.id, dishIds)) : [],
    ]);
    const profileById = new Map(profileRows.map((row) => [row.id, row]));
    const dishById = new Map(dishRows.map((row) => [row.id, row]));
    return Response.json({
      blocks: blockedRows.map((row) => ({ id: row.blockedId, label: profileById.get(row.blockedId)?.label ?? row.blockedId, handle: profileById.get(row.blockedId)?.handle ?? null })),
      mutes: mutedRows.map((row) => ({ id: row.mutedId, label: profileById.get(row.mutedId)?.label ?? row.mutedId, handle: profileById.get(row.mutedId)?.handle ?? null })),
      hiddenDishes: hiddenRows.map((row) => ({ id: row.dishId, label: dishById.get(row.dishId)?.label ?? row.dishId })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "safety_action_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const body = await request.json() as { action?: "block" | "mute" | "hide"; targetId?: string };
    const targetId = body.targetId?.trim() ?? "";
    if (!targetId || targetId.length > 160 || !body.action) return Response.json({ error: "invalid_safety_action" }, { status: 400 });
    const db = await getDb();
    if (body.action === "block") {
      if (targetId === identity.id) return Response.json({ error: "cannot_block_self" }, { status: 400 });
      await db.insert(blocks).values({ blockerId: identity.id, blockedId: targetId }).onConflictDoNothing();
      await db.delete(follows).where(or(and(eq(follows.followerId, identity.id), eq(follows.followingId, targetId)), and(eq(follows.followerId, targetId), eq(follows.followingId, identity.id))));
      await db.delete(notifications).where(or(and(eq(notifications.userId, identity.id), eq(notifications.actorId, targetId)), and(eq(notifications.userId, targetId), eq(notifications.actorId, identity.id))));
    } else if (body.action === "mute") {
      if (targetId === identity.id) return Response.json({ error: "cannot_mute_self" }, { status: 400 });
      await db.insert(mutes).values({ muterId: identity.id, mutedId: targetId }).onConflictDoNothing();
    } else await db.insert(hiddenDishes).values({ userId: identity.id, dishId: targetId }).onConflictDoNothing();
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "safety_action_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
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
