import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes, restaurants } from "@/db/schema";
import type { DishAnalysis } from "@/lib/dish-analysis";
import { normalizePublicationRestaurant, preparePublishedDish, type PublicationKnowledge, type PublishRestaurantInput } from "@/lib/dish-records";
import { requireIdentity } from "@/lib/identity";
import { rankNearbyMatches } from "@/lib/nearby-matches";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { storeDishImage } from "@/lib/uploads";

export const runtime = "edge";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  const db = await getDb();
  const rows = await db.select({ dish: publishedDishes, restaurant: restaurants }).from(publishedDishes).leftJoin(restaurants, eq(publishedDishes.restaurantId, restaurants.id)).where(eq(publishedDishes.ownerId, identity.id)).orderBy(desc(publishedDishes.createdAt)).limit(30);
  return Response.json({ dishes: rows.map(({ dish, restaurant }) => ({ ...dish, restaurant, imageUrl: dish.imageKey ? `/api/media/${dish.imageKey}` : null })) }, { headers: cors });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  const body = await request.json() as { analysis?: DishAnalysis; sourceMode?: "live" | "demo"; imageDataUrl?: string; restaurant?: PublishRestaurantInput; knowledge?: PublicationKnowledge; language?: SupportedLanguage; reviewConfirmed?: boolean; restaurantConfirmed?: boolean };
  if (!validAnalysis(body.analysis) || !["live", "demo"].includes(body.sourceMode ?? "") || !body.restaurant || !body.knowledge || !body.reviewConfirmed || !body.restaurantConfirmed || !body.language || !SUPPORTED_LANGUAGES.includes(body.language)) {
    return Response.json({ error: "review_and_restaurant_confirmation_required" }, { status: 400, headers: cors });
  }
  let restaurantInput: ReturnType<typeof normalizePublicationRestaurant>;
  let dishRecord: ReturnType<typeof preparePublishedDish>;
  try {
    restaurantInput = normalizePublicationRestaurant(body.restaurant);
    dishRecord = preparePublishedDish({ analysis: body.analysis, sourceMode: body.sourceMode!, knowledge: body.knowledge, language: body.language, restaurant: restaurantInput });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "invalid_publication" }, { status: 400, headers: cors });
  }
  const imageKey = body.imageDataUrl ? await storeDishImage(body.imageDataUrl, identity.id) : null;
  const id = crypto.randomUUID();
  const db = await getDb();
  let restaurantId = crypto.randomUUID();
  const restaurantValues = { id: restaurantId, ...restaurantInput, createdById: identity.id, updatedAt: new Date().toISOString() };
  if (restaurantInput.provider === "google" && restaurantInput.providerPlaceId) {
    await db.insert(restaurants).values(restaurantValues).onConflictDoUpdate({
      target: [restaurants.provider, restaurants.providerPlaceId],
      set: { ...restaurantInput, createdById: identity.id, updatedAt: new Date().toISOString() },
    });
    const [persisted] = await db.select({ id: restaurants.id }).from(restaurants).where(and(eq(restaurants.provider, "google"), eq(restaurants.providerPlaceId, restaurantInput.providerPlaceId))).limit(1);
    if (!persisted) return Response.json({ error: "restaurant_persistence_failed" }, { status: 503, headers: cors });
    restaurantId = persisted.id;
  } else {
    await db.insert(restaurants).values(restaurantValues);
  }
  const reviewedAnalysis = { name: body.analysis.name, cuisine: body.analysis.cuisine, ingredients: body.analysis.ingredients, dietary: body.analysis.dietary, confidence: body.analysis.confidence, description: body.analysis.description };
  await db.insert(publishedDishes).values({ id, ownerId: identity.id, contributorId: identity.id, restaurantId, sourceMode: body.sourceMode!, ...reviewedAnalysis, ...dishRecord, confidence: Math.round(body.analysis.confidence), imageKey });
  const dish = { id, ownerId: identity.id, contributorId: identity.id, restaurantId, sourceMode: body.sourceMode, ...body.analysis, ...dishRecord, imageKey, imageUrl: imageKey ? `/api/media/${imageKey}` : null };
  return Response.json({ dish, matches: rankNearbyMatches(body.analysis) }, { status: 201, headers: cors });
}

function validAnalysis(value?: DishAnalysis): value is DishAnalysis {
  return Boolean(value && value.name?.trim() && value.cuisine?.trim() && value.ingredients?.trim() && value.dietary?.trim() && value.description?.trim() && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100 && value.canonical?.dishName?.trim() && value.canonical?.cuisine?.trim() && Array.isArray(value.canonical.ingredients) && Array.isArray(value.canonical.flavours) && ["ai_normalized", "user_reviewed"].includes(value.canonical.metadataSource));
}
