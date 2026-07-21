import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, notifications, profiles, publishedDishes } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";
const COMMENT_LIMIT = 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const rows = await db.select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, updatedAt: comments.updatedAt, userId: comments.userId, displayName: profiles.displayName, handle: profiles.handle, avatarUrl: profiles.avatarUrl })
    .from(comments).leftJoin(profiles, eq(profiles.userId, comments.userId)).where(and(eq(comments.dishId, id), eq(comments.moderationStatus, "active"))).orderBy(desc(comments.createdAt)).limit(100);
  return Response.json({ comments: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const { id } = await params;
    const body = await request.json() as { body?: string };
    const text = body.body?.trim() ?? "";
    if (!text || text.length > COMMENT_LIMIT) return Response.json({ error: `Comment must be 1–${COMMENT_LIMIT} characters.` }, { status: 400 });
    const db = await getDb();
    const [dish] = await db.select({ id: publishedDishes.id, ownerId: publishedDishes.ownerId }).from(publishedDishes).where(eq(publishedDishes.id, id)).limit(1);
    if (!dish) return Response.json({ error: "Dish not found." }, { status: 404 });
    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(comments).values({ id: commentId, userId: identity.id, dishId: id, body: text, createdAt: now, updatedAt: now });
    if (dish.ownerId !== identity.id) {
      const dedupeKey = `comment:${commentId}`;
      await db.insert(notifications).values({ id: crypto.randomUUID(), userId: dish.ownerId, actorId: identity.id, type: "comment", targetId: id, dedupeKey, read: false, createdAt: now }).onConflictDoNothing();
    }
    const [profile] = await db.select({ displayName: profiles.displayName, handle: profiles.handle, avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
    return Response.json({ comment: { id: commentId, userId: identity.id, body: text, createdAt: now, updatedAt: now, ...profile } }, { status: 201 });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to add comment." }, { status });
  }
}
