import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, publishedDishes } from "@/db/schema";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { id, commentId } = await params;
    const body = await request.json() as { body?: string };
    const text = body.body?.trim() ?? "";
    if (!text || text.length > 1000) return Response.json({ error: "comment_length_invalid", code: "comment_length_invalid" }, { status: 400 });
    const db = await getDb();
    const [comment] = await db.select({ userId: comments.userId }).from(comments).where(and(eq(comments.id, commentId), eq(comments.dishId, id))).limit(1);
    if (!comment) return Response.json({ error: "comment_not_found", code: "comment_not_found" }, { status: 404 });
    if (comment.userId !== identity.id) return Response.json({ error: "own_comment_required", code: "own_comment_required" }, { status: 403 });
    const updatedAt = new Date().toISOString();
    await db.update(comments).set({ body: text, updatedAt }).where(eq(comments.id, commentId));
    return Response.json({ ok: true, comment: { id: commentId, body: text, updatedAt } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to edit comment." }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const { id, commentId } = await params;
    const db = await getDb();
    const [comment] = await db.select({ userId: comments.userId }).from(comments).where(and(eq(comments.id, commentId), eq(comments.dishId, id))).limit(1);
    if (!comment) return Response.json({ error: "comment_not_found", code: "comment_not_found" }, { status: 404 });
    const [dish] = await db.select({ ownerId: publishedDishes.ownerId }).from(publishedDishes).where(eq(publishedDishes.id, id)).limit(1);
    if (comment.userId !== identity.id && dish?.ownerId !== identity.id) return Response.json({ error: "comment_owner_or_dish_owner_required", code: "comment_owner_or_dish_owner_required" }, { status: 403 });
    await db.update(comments).set({ moderationStatus: "deleted", deletedAt: new Date().toISOString() }).where(eq(comments.id, commentId));
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to delete comment." }, { status });
  }
}
