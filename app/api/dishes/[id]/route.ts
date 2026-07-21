import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { deleteDishImage } from "@/lib/uploads";

export const runtime = "edge";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity || identity.authType === "guest") return Response.json({ error: "authentication_required" }, { status: 401 });
  const id = (await params).id;
  let body: { caption?: string; tasteNotes?: string; dietaryNotes?: string; personalComments?: string; locationTag?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_dish_update" }, { status: 400 }); }
  const fields = {
    caption: body.caption?.trim(), tasteNotes: body.tasteNotes?.trim(), dietaryNotes: body.dietaryNotes?.trim(), personalComments: body.personalComments?.trim(), locationTag: body.locationTag?.trim(),
  };
  if (Object.values(fields).some((value) => value !== undefined && value.length > 1_000)) return Response.json({ error: "dish_field_too_long" }, { status: 400 });
  const db = await getDb();
  const [dish] = await db.select({ id: publishedDishes.id }).from(publishedDishes).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id))).limit(1);
  if (!dish) return Response.json({ error: "published_dish_not_found" }, { status: 404 });
  await db.update(publishedDishes).set({ ...fields }).where(eq(publishedDishes.id, id));
  return Response.json({ ok: true, fields });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const id = (await params).id;
  const db = await getDb();
  const [dish] = await db.select({ id: publishedDishes.id, imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id))).limit(1);
  if (!dish) return Response.json({ error: "published_dish_not_found" }, { status: 404 });
  if (new URL(request.url).searchParams.get("hard") !== "true") {
    await db.update(publishedDishes).set({ moderationStatus: "deleted", deletedAt: new Date().toISOString() }).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id)));
    return new Response(null, { status: 204 });
  }
  if (dish.imageKey && !await deleteDishImage(dish.imageKey)) return Response.json({ error: "uploads_unavailable" }, { status: 503 });
  await db.delete(publishedDishes).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id)));
  return new Response(null, { status: 204 });
}
