import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { deleteDishImage } from "@/lib/uploads";

export const runtime = "edge";

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
