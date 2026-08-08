import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, publishedDishes, restaurants, saves } from "@/db/schema";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";
import { engagementColumns, withViewerState } from "@/lib/feed";

const cors = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

/**
 * Saves answer with whole dishes, not only their ids: the Saved route renders
 * the same card as every other feed, so it needs the same payload rather than a
 * second round of lookups.
 */
export async function GET(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const db = await getDb();
    const origin = new URL(request.url).origin;
    const rows = await db.select({
      id: publishedDishes.id,
      name: publishedDishes.name,
      cuisine: publishedDishes.cuisine,
      description: publishedDishes.description,
      createdAt: publishedDishes.createdAt,
      ownerId: publishedDishes.ownerId,
      imageKey: publishedDishes.imageKey,
      provenance: publishedDishes.provenance,
      verificationStatus: publishedDishes.verificationStatus,
      restaurantName: restaurants.name,
      locality: restaurants.locality,
      contributorName: profiles.displayName,
      contributorHandle: profiles.handle,
      contributorAvatarUrl: profiles.avatarUrl,
      savedAt: saves.createdAt,
      ...engagementColumns(identity.id),
    }).from(saves)
      .innerJoin(publishedDishes, eq(publishedDishes.id, saves.dishId))
      .leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId))
      .leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId))
      .where(and(eq(saves.userId, identity.id), eq(publishedDishes.moderationStatus, "active")))
      .orderBy(desc(saves.createdAt));
    const dishes = rows.map(({ imageKey, ...dish }) => ({ ...withViewerState(dish), imageUrl: imageKey ? `${origin}/api/media/${imageKey}` : null }));
    return Response.json({ dishes, savedDishIds: dishes.map((dish) => dish.id) }, { headers: cors });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to load saves." }, { status, headers: cors });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireOnboardedIdentity(request);
    const body = await request.json() as { dishId?: string; saved?: boolean };
    const dishId = typeof body.dishId === "string" ? body.dishId.trim() : "";
    if (!dishId || dishId.length > 128) return Response.json({ error: "valid_dish_id_required", code: "valid_dish_id_required" }, { status: 400, headers: cors });
    const db = await getDb();
    if (body.saved === false) {
      await db.delete(saves).where(and(eq(saves.userId, identity.id), eq(saves.dishId, dishId)));
      return Response.json({ ok: true, dishId, saved: false }, { headers: cors });
    }
    // A save that names a dish nobody published is a client bug, not an empty
    // list: the foreign key would reject it anyway, so say so plainly.
    const [dish] = await db.select({ id: publishedDishes.id }).from(publishedDishes)
      .where(and(eq(publishedDishes.id, dishId), eq(publishedDishes.moderationStatus, "active"))).limit(1);
    if (!dish) return Response.json({ error: "dish_not_found", code: "dish_not_found" }, { status: 404, headers: cors });
    await db.insert(saves).values({ userId: identity.id, dishId }).onConflictDoNothing();
    return Response.json({ ok: true, dishId, saved: true }, { headers: cors });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to update saves." }, { status, headers: cors });
  }
}
