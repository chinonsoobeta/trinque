import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, groups, notifications, profiles } from "@/db/schema";
import { AuthenticationError, normalizeHandle, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const groupId = (await params).id;
    const body = await request.json() as { handle?: string };
    const handle = normalizeHandle(body.handle ?? "");
    if (!handle) return Response.json({ error: "A valid profile handle is required." }, { status: 400 });

    const db = await getDb();
    const [group] = await db.select({ id: groups.id, ownerId: groups.ownerId, inviteCode: groups.inviteCode, inviteExpiresAt: groups.inviteExpiresAt, inviteRevokedAt: groups.inviteRevokedAt })
      .from(groups).where(and(eq(groups.id, groupId), eq(groups.ownerId, identity.id))).limit(1);
    if (!group) return Response.json({ error: "Group not found or you do not own it." }, { status: 404 });
    if (group.inviteRevokedAt) return Response.json({ error: "This group invite has been revoked." }, { status: 409 });
    if (group.inviteExpiresAt && Date.parse(group.inviteExpiresAt) <= Date.now()) return Response.json({ error: "This group invite has expired." }, { status: 409 });

    const [target] = await db.select({ userId: profiles.userId, handle: profiles.handle }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
    if (!target) return Response.json({ error: "No Trinque profile was found for that handle." }, { status: 404 });
    if (target.userId === identity.id) return Response.json({ error: "You cannot invite yourself." }, { status: 400 });
    const [blocked] = await db.select({ blockerId: blocks.blockerId }).from(blocks).where(or(and(eq(blocks.blockerId, identity.id), eq(blocks.blockedId, target.userId)), and(eq(blocks.blockerId, target.userId), eq(blocks.blockedId, identity.id)))).limit(1);
    if (blocked) return Response.json({ error: "No Trinque profile was found for that handle." }, { status: 404 });

    const dedupeKey = `group-invite:${group.id}:${target.userId}`;
    const now = new Date().toISOString();
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: target.userId,
      actorId: identity.id,
      type: "group_invite",
      targetId: group.inviteCode,
      dedupeKey,
      read: false,
      createdAt: now,
    }).onConflictDoUpdate({
      target: notifications.dedupeKey,
      set: { actorId: identity.id, targetId: group.inviteCode, read: false, createdAt: now },
    });
    return Response.json({ ok: true, invitedHandle: target.handle, inviteCode: group.inviteCode });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unable to send group invite." }, { status: 500 });
  }
}
