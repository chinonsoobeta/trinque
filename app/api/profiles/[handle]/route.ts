import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { follows, profiles, publishedDishes, users } from "@/db/schema";
import { AuthenticationError, getOptionalIdentity, normalizeHandle, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;
  const handle = normalizeHandle(rawHandle);
  if (!handle) return Response.json({ error: "Profile not found." }, { status: 404 });
  const db = await getDb();
  const [profile] = await db.select({
    userId: profiles.userId,
    displayName: profiles.displayName,
    handle: profiles.handle,
    bio: profiles.bio,
    avatarUrl: profiles.avatarUrl,
    location: profiles.location,
    joinedAt: profiles.joinedAt,
  }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
  if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
  const [[followers], [following], [dishCount], dishes, viewer] = await Promise.all([
    db.select({ count: count() }).from(follows).where(eq(follows.followingId, profile.userId)),
    db.select({ count: count() }).from(follows).where(eq(follows.followerId, profile.userId)),
    db.select({ count: count() }).from(publishedDishes).where(eq(publishedDishes.ownerId, profile.userId)),
    db.select({ id: publishedDishes.id, name: publishedDishes.name, cuisine: publishedDishes.cuisine, description: publishedDishes.description, confidence: publishedDishes.confidence, createdAt: publishedDishes.createdAt }).from(publishedDishes).where(eq(publishedDishes.ownerId, profile.userId)).orderBy(desc(publishedDishes.createdAt)).limit(24),
    getOptionalIdentity(request),
  ]);
  let viewerFollowing = false;
  if (viewer && viewer.id !== profile.userId && viewer.authType !== "guest") {
    const [row] = await db.select({ followerId: follows.followerId }).from(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, profile.userId))).limit(1);
    viewerFollowing = Boolean(row);
  }
  return Response.json({ profile, counts: { followers: followers?.count ?? 0, following: following?.count ?? 0, dishes: dishCount?.count ?? 0 }, dishes, viewerFollowing, viewerIsOwner: Boolean(viewer && viewer.authType !== "guest" && viewer.id === profile.userId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const { handle: rawHandle } = await params;
    const currentHandle = normalizeHandle(rawHandle);
    if (!currentHandle) return Response.json({ error: "Profile not found." }, { status: 404 });
    const body = await request.json() as { displayName?: string; handle?: string; bio?: string; location?: string | null; avatarUrl?: string | null };
    const db = await getDb();
    const [current] = await db.select().from(profiles).where(eq(profiles.handle, currentHandle)).limit(1);
    if (!current) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (current.userId !== identity.id) return Response.json({ error: "You can only edit your own profile." }, { status: 403 });

    const displayName = body.displayName === undefined ? current.displayName : body.displayName.trim();
    const bio = body.bio === undefined ? current.bio : body.bio.trim();
    const location = body.location === undefined ? current.location : body.location?.trim() || null;
    const avatarUrl = body.avatarUrl === undefined ? current.avatarUrl : body.avatarUrl?.trim() || null;
    const nextHandle = body.handle === undefined ? current.handle : normalizeHandle(body.handle);
    if (!displayName || displayName.length > 80) return Response.json({ error: "Display name must be 1–80 characters." }, { status: 400 });
    if (!nextHandle) return Response.json({ error: "Handle must be 3–30 lowercase letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
    if (bio.length > 500 || (location?.length ?? 0) > 100) return Response.json({ error: "Profile fields are too long." }, { status: 400 });
    if (avatarUrl && !/^https:\/\//i.test(avatarUrl) && !avatarUrl.startsWith("/")) return Response.json({ error: "Avatar URL must be HTTPS or an app-relative URL." }, { status: 400 });
    const [collision] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.handle, nextHandle)).limit(1);
    if (collision && collision.userId !== identity.id) return Response.json({ error: "That handle is already taken." }, { status: 409 });

    const now = new Date().toISOString();
    await db.update(profiles).set({ displayName, handle: nextHandle, bio, location, avatarUrl, updatedAt: now }).where(eq(profiles.userId, identity.id));
    await db.update(users).set({ displayName, avatarUrl, updatedAt: now }).where(eq(users.id, identity.id));
    return Response.json({ ok: true, profile: { ...current, displayName, handle: nextHandle, bio, location, avatarUrl, updatedAt: now } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to update profile." }, { status });
  }
}
