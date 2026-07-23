import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, hiddenDishes, mutes, publishedDishes, restaurants } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

/** Public-to-Trinque feed: only reviewed, published records; never raw profiles or email addresses. */
export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const db = await getDb();
  const origin = new URL(request.url).origin;
  const rows = await db.select({ dish: publishedDishes, restaurant: restaurants })
    .from(publishedDishes)
    .leftJoin(restaurants, eq(publishedDishes.restaurantId, restaurants.id))
    .where(and(
      eq(publishedDishes.moderationStatus, "active"),
      sql`NOT EXISTS (SELECT 1 FROM ${blocks} WHERE (${blocks.blockerId} = ${identity.id} AND ${blocks.blockedId} = ${publishedDishes.ownerId}) OR (${blocks.blockerId} = ${publishedDishes.ownerId} AND ${blocks.blockedId} = ${identity.id}))`,
      sql`NOT EXISTS (SELECT 1 FROM ${mutes} WHERE ${mutes.muterId} = ${identity.id} AND ${mutes.mutedId} = ${publishedDishes.ownerId})`,
      sql`NOT EXISTS (SELECT 1 FROM ${hiddenDishes} WHERE ${hiddenDishes.userId} = ${identity.id} AND ${hiddenDishes.dishId} = ${publishedDishes.id})`,
    ))
    .orderBy(desc(publishedDishes.createdAt))
    .limit(40);
  return Response.json({ dishes: rows.map(({ dish, restaurant }) => ({
    ...dish,
    restaurant,
    contributorLabel: "Community member",
    isOwner: dish.ownerId === identity.id,
    moderationStatus: dish.moderationStatus,
    imageUrl: dish.imageKey ? `${origin}/api/media/${dish.imageKey}` : null,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}
