import { desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getOptionalIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const viewer = await getOptionalIdentity(request);
  const db = await getDb();
  const exclusion = viewer && viewer.authType !== "guest"
    ? sql`${profiles.userId} <> ${viewer.id} AND NOT EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = ${viewer.id} AND f2.following_id = ${profiles.userId})`
    : undefined;
  const followerCount = sql<number>`(SELECT COUNT(*) FROM follows f WHERE f.following_id = ${profiles.userId})`;
  const recentDishCount = sql<number>`(SELECT COUNT(*) FROM published_dishes d WHERE d.owner_id = ${profiles.userId} AND d.created_at >= datetime('now', '-30 days'))`;
  const activityScore = sql<number>`((${followerCount}) * 2 + (${recentDishCount}) * 3)`;
  const rows = await db.select({ userId: profiles.userId, displayName: profiles.displayName, handle: profiles.handle, bio: profiles.bio, avatarUrl: profiles.avatarUrl, location: profiles.location, followerCount, recentDishCount, activityScore })
    .from(profiles)
    .where(exclusion)
    .orderBy(sql`${activityScore} DESC`, desc(profiles.joinedAt))
    .limit(12);
  return Response.json({ profiles: rows }, { headers: { "Cache-Control": viewer ? "no-store" : "public, max-age=60" } });
}
