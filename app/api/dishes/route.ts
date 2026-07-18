import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes } from "@/db/schema";
import type { DishAnalysis } from "@/lib/dish-analysis";
import { requireIdentity } from "@/lib/identity";
import { rankNearbyMatches } from "@/lib/nearby-matches";
import { storeDishImage } from "@/lib/uploads";

export const runtime = "edge";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  const db = await getDb();
  const rows = await db.select().from(publishedDishes).where(eq(publishedDishes.ownerId, identity.id)).orderBy(desc(publishedDishes.createdAt)).limit(30);
  return Response.json({ dishes: rows.map((dish) => ({ ...dish, imageUrl: dish.imageKey ? `/api/media/${dish.imageKey}` : null })) }, { headers: cors });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  const body = await request.json() as { analysis?: DishAnalysis; sourceMode?: "live" | "demo"; imageDataUrl?: string };
  if (!validAnalysis(body.analysis) || !["live", "demo"].includes(body.sourceMode ?? "")) return Response.json({ error: "Reviewed analysis and source mode are required." }, { status: 400, headers: cors });
  const imageKey = body.imageDataUrl ? await storeDishImage(body.imageDataUrl, identity.id) : null;
  const id = crypto.randomUUID();
  const db = await getDb();
  await db.insert(publishedDishes).values({ id, ownerId: identity.id, sourceMode: body.sourceMode!, ...body.analysis, confidence: Math.round(body.analysis.confidence), imageKey });
  const dish = { id, ownerId: identity.id, sourceMode: body.sourceMode, ...body.analysis, imageKey, imageUrl: imageKey ? `/api/media/${imageKey}` : null };
  return Response.json({ dish, matches: rankNearbyMatches(body.analysis) }, { status: 201, headers: cors });
}

function validAnalysis(value?: DishAnalysis): value is DishAnalysis {
  return Boolean(value && value.name?.trim() && value.cuisine?.trim() && value.ingredients?.trim() && value.dietary?.trim() && value.description?.trim() && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100);
}
