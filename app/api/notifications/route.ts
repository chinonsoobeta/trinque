import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, mutes, notifications, profiles } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(MAX_LIMIT, Number(url.searchParams.get("limit") ?? 30) || 30));
    const db = await getDb();
    const rows = await db.select({ id: notifications.id, type: notifications.type, targetId: notifications.targetId, read: notifications.read, createdAt: notifications.createdAt, actorId: notifications.actorId, actorDisplayName: profiles.displayName, actorHandle: profiles.handle, actorAvatarUrl: profiles.avatarUrl })
      .from(notifications).leftJoin(profiles, eq(profiles.userId, notifications.actorId)).where(and(
        eq(notifications.userId, identity.id),
        sql`(${notifications.actorId} IS NULL OR (NOT EXISTS (SELECT 1 FROM ${blocks} WHERE (${blocks.blockerId} = ${identity.id} AND ${blocks.blockedId} = ${notifications.actorId}) OR (${blocks.blockerId} = ${notifications.actorId} AND ${blocks.blockedId} = ${identity.id})) AND NOT EXISTS (SELECT 1 FROM ${mutes} WHERE ${mutes.muterId} = ${identity.id} AND ${mutes.mutedId} = ${notifications.actorId})))`,
      )).orderBy(desc(notifications.createdAt)).limit(limit);
    return Response.json({ notifications: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error, "Unable to load notifications."); }
}

export async function PATCH(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const body = await request.json() as { id?: string; ids?: string[]; all?: boolean };
    const db = await getDb();
    if (body.all) await db.update(notifications).set({ read: true }).where(eq(notifications.userId, identity.id));
    else if (body.id) await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, identity.id), eq(notifications.id, body.id)));
    else if (body.ids?.length) await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, identity.id), inArray(notifications.id, body.ids.slice(0, 100))));
    else return Response.json({ error: "notification_id_or_all_required", code: "notification_id_or_all_required" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) { return authError(error, "Unable to update notifications."); }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const db = await getDb();
    if (id) await db.delete(notifications).where(and(eq(notifications.userId, identity.id), eq(notifications.id, id)));
    else await db.delete(notifications).where(eq(notifications.userId, identity.id));
    return Response.json({ ok: true });
  } catch (error) { return authError(error, "Unable to clear notifications."); }
}

function authError(error: unknown, fallback: string) {
  const status = error instanceof AuthenticationError ? error.status : 503;
  return Response.json({ error: error instanceof AuthenticationError ? error.message : fallback }, { status });
}
