import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { storeDishImage, deleteDishImage } from "@/lib/uploads";

export const runtime = "edge";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const id = (await params).id;
  const { imageDataUrl, retainImage } = await request.json() as { imageDataUrl?: string; retainImage?: boolean };
  if (!imageDataUrl) return Response.json({ error: "image_data_required" }, { status: 400 });
  const db = await getDb();
  const [dish] = await db.select({ imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id))).limit(1);
  if (!dish) return Response.json({ error: "published_dish_not_found" }, { status: 404 });
  let imageKey: string | null = null;
  try { imageKey = retainImage === true ? await storeDishImage(imageDataUrl, identity.id) : null; } catch { return Response.json({ error: "invalid_image" }, { status: 422 }); }
  if (imageKey) {
    if (dish.imageKey) await deleteDishImage(dish.imageKey);
    await db.update(publishedDishes).set({ imageKey }).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id)));
  }
  return Response.json({ imageUrl: imageKey ? `/api/media/${imageKey}` : null });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const id = (await params).id;
  const db = await getDb();
  const [dish] = await db.select({ imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id))).limit(1);
  if (!dish) return Response.json({ error: "published_dish_not_found" }, { status: 404 });
  if (dish.imageKey && !await deleteDishImage(dish.imageKey)) return Response.json({ error: "uploads_unavailable" }, { status: 503 });
  await db.update(publishedDishes).set({ imageKey: null }).where(and(eq(publishedDishes.id, id), eq(publishedDishes.ownerId, identity.id)));
  return new Response(null, { status: 204 });
}
