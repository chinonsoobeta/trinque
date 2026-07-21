import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, publishedDishes, restaurants } from "@/db/schema";

export const runtime = "edge";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Trending score over the previous 24 hours:
 *   3 points per like + 2 points per comment + up to 1 recency point.
 * Recency decays linearly from 1 to 0 over 24 hours. Engagement is calculated
 * with correlated aggregate subqueries in one SQL statement to avoid N+1 reads
 * and to avoid the count multiplication caused by joining likes and comments.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));
  const db = await getDb();
  const origin = new URL(request.url).origin;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const likes24h = sql<number>`(SELECT COUNT(*) FROM likes l WHERE l.dish_id = ${publishedDishes.id} AND l.created_at >= ${cutoff})`;
  const comments24h = sql<number>`(SELECT COUNT(*) FROM comments c WHERE c.dish_id = ${publishedDishes.id} AND c.created_at >= ${cutoff})`;
  const recency = sql<number>`MAX(0.0, 1.0 - ((julianday('now') - julianday(${publishedDishes.createdAt})) * 24.0 / 24.0))`;
  const score = sql<number>`((${likes24h}) * 3.0 + (${comments24h}) * 2.0 + (${recency}))`;
  const rows = await db.select({
    id: publishedDishes.id,
    name: publishedDishes.name,
    cuisine: publishedDishes.cuisine,
    description: publishedDishes.description,
    confidence: publishedDishes.confidence,
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
    likes24h,
    comments24h,
    score,
  }).from(publishedDishes)
    .leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId))
    .leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId)).where(eq(publishedDishes.moderationStatus, "active"))
    .orderBy(sql`${score} DESC`, desc(publishedDishes.createdAt), desc(publishedDishes.id))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  return Response.json({ dishes: visible.map(({ imageKey, ...dish }) => ({ ...dish, imageUrl: imageKey ? `${origin}/api/media/${imageKey}` : null })), nextOffset: hasMore ? offset + limit : null }, { headers: { "Cache-Control": "public, max-age=30" } });
}

function clampLimit(raw: string | null) { const value = Number(raw ?? DEFAULT_LIMIT); return Number.isInteger(value) ? Math.max(1, Math.min(MAX_LIMIT, value)) : DEFAULT_LIMIT; }
function clampOffset(raw: string | null) { const value = Number(raw ?? 0); return Number.isInteger(value) ? Math.max(0, Math.min(10_000, value)) : 0; }
