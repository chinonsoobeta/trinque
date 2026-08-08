import { sql, type SQL } from "drizzle-orm";
import { publishedDishes } from "../db/schema.ts";

/**
 * Engagement counts and the viewer's own like/save state, expressed as
 * correlated subqueries so a feed answers with everything a card needs.
 *
 * Cards used to fetch their own like state on mount, which cost one request per
 * card — twenty cards meant twenty round trips for data the feed query already
 * had in hand.
 */
export function engagementColumns(viewerId: string | null) {
  return {
    likesCount: sql<number>`(SELECT COUNT(*) FROM likes l WHERE l.dish_id = ${publishedDishes.id})`,
    commentsCount: sql<number>`(SELECT COUNT(*) FROM comments c WHERE c.dish_id = ${publishedDishes.id} AND c.moderation_status = 'active')`,
    viewerLiked: viewerId
      ? sql<number>`(SELECT COUNT(*) FROM likes l WHERE l.dish_id = ${publishedDishes.id} AND l.user_id = ${viewerId})`
      : sql<number>`0`,
    viewerSaved: viewerId
      ? sql<number>`(SELECT COUNT(*) FROM saves s WHERE s.dish_id = ${publishedDishes.id} AND s.user_id = ${viewerId})`
      : sql<number>`0`,
  };
}

/** Turns the 0/1 counts above into the booleans a card consumes. */
export function withViewerState<T extends { viewerLiked: number; viewerSaved: number }>(row: T) {
  const { viewerLiked, viewerSaved, ...rest } = row;
  return { ...rest, viewerLiked: viewerLiked > 0, viewerSaved: viewerSaved > 0 };
}

/** How far a feed had to reach before it found anything to show. */
export type FeedReach = "requested" | "widened" | "everywhere";

export const MAX_RADIUS_KM = 500;
const DEFAULT_RADIUS_KM = 25;
/** One widening step before giving up on the area entirely. */
const WIDENING_FACTOR = 4;

export function parseArea(params: URLSearchParams): { latitude: number; longitude: number; radiusKm: number } | null {
  const rawLatitude = params.get("lat");
  const rawLongitude = params.get("lng");
  // Absence has to be checked before conversion: `Number(null)` is 0, which
  // would silently turn "no area given" into a point in the Gulf of Guinea.
  if (rawLatitude === null || rawLongitude === null || rawLatitude === "" || rawLongitude === "") return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const requested = Number(params.get("radiusKm") ?? DEFAULT_RADIUS_KM);
  const radiusKm = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_RADIUS_KM, requested)) : DEFAULT_RADIUS_KM;
  return { latitude, longitude, radiusKm };
}

/**
 * A bounding box rather than a great-circle distance: it is an index-friendly
 * comparison on the two stored columns, and a feed does not need the precision
 * that the more expensive calculation would buy.
 */
export function withinArea(area: { latitude: number; longitude: number; radiusKm: number }): SQL {
  const latitudeDelta = area.radiusKm / 111;
  const longitudeDelta = area.radiusKm / Math.max(1, 111 * Math.cos((area.latitude * Math.PI) / 180));
  return sql`${publishedDishes.latitude} IS NOT NULL AND ${publishedDishes.longitude} IS NOT NULL
    AND ${publishedDishes.latitude} BETWEEN ${area.latitude - latitudeDelta} AND ${area.latitude + latitudeDelta}
    AND ${publishedDishes.longitude} BETWEEN ${area.longitude - longitudeDelta} AND ${area.longitude + longitudeDelta}`;
}

/**
 * Runs `query` against the requested area, then against a wider one, then with
 * no area at all — and reports which of those produced the rows, so the surface
 * can say it is showing results from further out.
 *
 * An empty state then means the database is genuinely empty, not that the
 * viewer happens to be standing somewhere quiet.
 */
export async function broadenUntilFound<T>(
  area: { latitude: number; longitude: number; radiusKm: number } | null,
  query: (filter: SQL | undefined) => Promise<T[]>,
): Promise<{ rows: T[]; reach: FeedReach }> {
  // No area asked for means everywhere *is* what was asked for — there is
  // nothing to disclose, so this is not a broadening.
  if (!area) return { rows: await query(undefined), reach: "requested" };
  const requested = await query(withinArea(area));
  if (requested.length > 0) return { rows: requested, reach: "requested" };
  const widerRadius = Math.min(MAX_RADIUS_KM, area.radiusKm * WIDENING_FACTOR);
  if (widerRadius > area.radiusKm) {
    const widened = await query(withinArea({ ...area, radiusKm: widerRadius }));
    if (widened.length > 0) return { rows: widened, reach: "widened" };
  }
  return { rows: await query(undefined), reach: "everywhere" };
}
