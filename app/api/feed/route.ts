import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes, restaurants } from "@/db/schema";
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
    .orderBy(desc(publishedDishes.createdAt))
    .limit(40);
  return Response.json({ dishes: rows.map(({ dish, restaurant }) => ({
    ...dish,
    restaurant,
    contributorLabel: "Community member",
    isOwner: dish.ownerId === identity.id,
    imageUrl: dish.imageKey ? `${origin}/api/media/${dish.imageKey}` : null,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}
