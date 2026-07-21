import { and, desc, eq, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { follows, profiles, publishedDishes, restaurants } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const url = new URL(request.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const cursor = parseCursor(url.searchParams.get("cursor"));
    const db = await getDb();
    const origin = new URL(request.url).origin;
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
    }).from(publishedDishes)
      .innerJoin(follows, and(eq(follows.followingId, publishedDishes.ownerId), eq(follows.followerId, identity.id)))
      .leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId))
      .leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId))
      .where(and(eq(publishedDishes.moderationStatus, "active"), cursor ? or(lt(publishedDishes.createdAt, cursor.createdAt), and(eq(publishedDishes.createdAt, cursor.createdAt), lt(publishedDishes.id, cursor.id))) : undefined))
      .orderBy(desc(publishedDishes.createdAt), desc(publishedDishes.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const dishes = hasMore ? rows.slice(0, limit) : rows;
    const last = dishes.at(-1);
    return Response.json({ dishes: dishes.map(({ imageKey, ...dish }) => ({ ...dish, imageUrl: imageKey ? `${origin}/api/media/${imageKey}` : null })), nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "Unable to load following feed." }, { status });
  }
}

function clampLimit(raw: string | null) {
  const value = Number(raw ?? DEFAULT_LIMIT);
  return Number.isInteger(value) ? Math.max(1, Math.min(MAX_LIMIT, value)) : DEFAULT_LIMIT;
}

function encodeCursor(createdAt: string, id: string) { return encodeURIComponent(`${createdAt}|${id}`); }
function parseCursor(value: string | null): { createdAt: string; id: string } | null {
  if (!value) return null;
  try { const [createdAt, id] = decodeURIComponent(value).split("|", 2); return createdAt && id ? { createdAt, id } : null; }
  catch { return null; }
}
