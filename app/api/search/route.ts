import { and, desc, eq, or, sql, type AnyColumn } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, publishedDishes, restaurants } from "@/db/schema";
import { engagementColumns, withViewerState } from "@/lib/feed";
import { getOptionalIdentity } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY = 80;

/**
 * One search across dishes and people.
 *
 * Explore offered trending and following but nothing to type into, so the only
 * way to reach a specific dish or person was to already know their URL. Dishes
 * match on name, cuisine, description and the restaurant they were eaten at;
 * people on display name and handle.
 *
 * Like and save state is folded into the dish rows here for the same reason the
 * feeds do it: twenty result cards must not each ask the server whether the
 * viewer liked them.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalize(url.searchParams.get("q"));
  const limit = clamp(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  if (!query) return Response.json({ query: "", dishes: [], profiles: [] }, { headers: { "Cache-Control": "no-store" } });

  const db = await getDb();
  const viewer = await getOptionalIdentity(request).catch(() => null);
  const viewerId = viewer && viewer.authType !== "guest" ? viewer.id : null;
  // Escape the wildcards so a query of "100%" looks for that text rather than
  // matching every row.
  const like = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const matches = (column: AnyColumn) => sql`LOWER(${column}) LIKE ${like} ESCAPE '\\'`;

  const [dishRows, peopleRows] = await Promise.all([
    db.select({
      id: publishedDishes.id,
      name: publishedDishes.name,
      cuisine: publishedDishes.cuisine,
      description: publishedDishes.description,
      createdAt: publishedDishes.createdAt,
      imageKey: publishedDishes.imageKey,
      provenance: publishedDishes.provenance,
      verificationStatus: publishedDishes.verificationStatus,
      restaurantName: restaurants.name,
      locality: restaurants.locality,
      contributorName: profiles.displayName,
      contributorHandle: profiles.handle,
      contributorAvatarUrl: profiles.avatarUrl,
      ...engagementColumns(viewerId),
    }).from(publishedDishes)
      .leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId))
      .leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId))
      .where(and(
        eq(publishedDishes.moderationStatus, "active"),
        or(matches(publishedDishes.name), matches(publishedDishes.cuisine), matches(publishedDishes.description), matches(restaurants.name)),
      ))
      // An exact name match first, then a name that starts with the query, then
      // everything else newest first — so searching "ramen" leads with dishes
      // called ramen rather than whichever one happens to be newest.
      .orderBy(
        sql`CASE WHEN LOWER(${publishedDishes.name}) = ${query} THEN 0 WHEN LOWER(${publishedDishes.name}) LIKE ${`${query}%`} THEN 1 ELSE 2 END`,
        desc(publishedDishes.createdAt),
        desc(publishedDishes.id),
      )
      .limit(limit),
    db.select({
      userId: profiles.userId, displayName: profiles.displayName, handle: profiles.handle,
      bio: profiles.bio, avatarUrl: profiles.avatarUrl, location: profiles.location,
      followerCount: sql<number>`(SELECT COUNT(*) FROM follows f WHERE f.following_id = ${profiles.userId})`,
    }).from(profiles)
      .where(or(matches(profiles.displayName), matches(profiles.handle)))
      .orderBy(
        sql`CASE WHEN LOWER(${profiles.handle}) = ${query} THEN 0 WHEN LOWER(${profiles.handle}) LIKE ${`${query}%`} THEN 1 ELSE 2 END`,
        desc(profiles.joinedAt),
      )
      .limit(12),
  ]);

  return Response.json({
    query,
    dishes: dishRows.map(({ imageKey, ...dish }) => ({ ...withViewerState(dish), imageUrl: imageKey ? `${url.origin}/api/media/${imageKey}` : null })),
    profiles: peopleRows,
  }, { headers: { "Cache-Control": viewerId ? "private, no-store" : "public, max-age=30" } });
}

function normalize(raw: string | null) {
  return (raw ?? "").trim().slice(0, MAX_QUERY).toLowerCase();
}

function clamp(raw: string | null, fallback: number, max: number) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) ? Math.max(1, Math.min(max, value)) : fallback;
}
