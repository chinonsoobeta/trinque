import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { follows, notifications, profiles } from "@/db/schema";
import { AuthenticationError, getOptionalIdentity, normalizeHandle, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

async function target(handleValue: string) {
  const handle = normalizeHandle(handleValue);
  if (!handle) return null;
  const db = await getDb();
  const [row] = await db.select({ userId: profiles.userId, handle: profiles.handle }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
  return row ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await target(handle);
  if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
  const db = await getDb();
  const viewer = await getOptionalIdentity(request);
  const [[total], relation] = await Promise.all([
    db.select({ count: count() }).from(follows).where(eq(follows.followingId, profile.userId)),
    viewer && viewer.authType !== "guest" ? db.select({ followerId: follows.followerId }).from(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, profile.userId))).limit(1) : Promise.resolve([]),
  ]);
  return Response.json({ count: total?.count ?? 0, following: relation.length > 0 });
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { handle } = await params;
    const profile = await target(handle);
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (profile.userId === identity.id) return Response.json({ error: "You cannot follow yourself." }, { status: 400 });
    const db = await getDb();
    const now = new Date().toISOString();
    const inserted = await db.insert(follows).values({ followerId: identity.id, followingId: profile.userId, createdAt: now }).onConflictDoNothing().returning({ followerId: follows.followerId });
    if (inserted.length) {
      const dedupeKey = `follow:${identity.id}:${profile.userId}`;
      await db.insert(notifications).values({ id: crypto.randomUUID(), userId: profile.userId, actorId: identity.id, type: "follow", targetId: identity.id, dedupeKey, read: false, createdAt: now }).onConflictDoUpdate({ target: notifications.dedupeKey, set: { read: false, createdAt: now } });
    }
    const [total] = await db.select({ count: count() }).from(follows).where(eq(follows.followingId, profile.userId));
    return Response.json({ following: true, count: total?.count ?? 0 });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to follow profile." }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { handle } = await params;
    const profile = await target(handle);
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    const db = await getDb();
    await db.delete(follows).where(and(eq(follows.followerId, identity.id), eq(follows.followingId, profile.userId)));
    const [total] = await db.select({ count: count() }).from(follows).where(eq(follows.followingId, profile.userId));
    return Response.json({ following: false, count: total?.count ?? 0 });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to unfollow profile." }, { status });
  }
}
