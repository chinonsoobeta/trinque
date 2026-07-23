import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { likes, notifications, publishedDishes } from "@/db/schema";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [dish] = await db.select({ id: publishedDishes.id }).from(publishedDishes).where(eq(publishedDishes.id, id)).limit(1);
  if (!dish) return Response.json({ error: "dish_not_found", code: "dish_not_found" }, { status: 404 });
  const viewer = await getOptionalIdentity(request);
  const [[total], relation] = await Promise.all([
    db.select({ count: count() }).from(likes).where(eq(likes.dishId, id)),
    viewer && viewer.authType !== "guest" ? db.select({ userId: likes.userId }).from(likes).where(and(eq(likes.userId, viewer.id), eq(likes.dishId, id))).limit(1) : Promise.resolve([]),
  ]);
  return Response.json({ liked: relation.length > 0, count: total?.count ?? 0 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { id } = await params;
    const db = await getDb();
    const [dish] = await db.select({ id: publishedDishes.id, ownerId: publishedDishes.ownerId }).from(publishedDishes).where(eq(publishedDishes.id, id)).limit(1);
    if (!dish) return Response.json({ error: "dish_not_found", code: "dish_not_found" }, { status: 404 });
    const now = new Date().toISOString();
    const inserted = await db.insert(likes).values({ userId: identity.id, dishId: id, createdAt: now }).onConflictDoNothing().returning({ userId: likes.userId });
    if (inserted.length && dish.ownerId !== identity.id) {
      const dedupeKey = `like:${identity.id}:${id}`;
      await db.insert(notifications).values({ id: crypto.randomUUID(), userId: dish.ownerId, actorId: identity.id, type: "like", targetId: id, dedupeKey, read: false, createdAt: now }).onConflictDoUpdate({ target: notifications.dedupeKey, set: { read: false, createdAt: now } });
    }
    const [total] = await db.select({ count: count() }).from(likes).where(eq(likes.dishId, id));
    return Response.json({ liked: true, count: total?.count ?? 0 });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to like dish." }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { id } = await params;
    const db = await getDb();
    await db.delete(likes).where(and(eq(likes.userId, identity.id), eq(likes.dishId, id)));
    const [total] = await db.select({ count: count() }).from(likes).where(eq(likes.dishId, id));
    return Response.json({ liked: false, count: total?.count ?? 0 });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to unlike dish." }, { status });
  }
}
