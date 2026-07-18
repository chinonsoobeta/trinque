import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { publishedDishes, restaurants, userConsents } from "@/db/schema";
import type { DishAnalysis } from "@/lib/dish-analysis";
import { matchNearby, type PublishedDishCandidate } from "@/lib/dish-matching";
import { normalizePublicationRestaurant, preparePublishedDish, type PublicationKnowledge, type PublishRestaurantInput } from "@/lib/dish-records";
import { requireIdentity } from "@/lib/identity";
import { placesApiKey } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { PlacesProviderError, type RestaurantPlace } from "@/lib/places/types";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { storeDishImage } from "@/lib/uploads";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";

export const runtime = "edge";
const cors = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  const db = await getDb();
  const rows = await db.select({ dish: publishedDishes, restaurant: restaurants }).from(publishedDishes).leftJoin(restaurants, eq(publishedDishes.restaurantId, restaurants.id)).where(eq(publishedDishes.ownerId, identity.id)).orderBy(desc(publishedDishes.createdAt)).limit(30);
  return Response.json({ dishes: rows.map(({ dish, restaurant }) => ({ ...dish, restaurant, imageUrl: dish.imageKey ? `/api/media/${dish.imageKey}` : null })) }, { headers: cors });
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401, headers: cors });
  try { await enforceUsageBudget("publish", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
  const body = await request.json() as { analysis?: DishAnalysis; sourceMode?: "live" | "demo"; imageDataUrl?: string; retainImage?: boolean; restaurant?: PublishRestaurantInput; knowledge?: PublicationKnowledge; language?: SupportedLanguage; reviewConfirmed?: boolean; restaurantConfirmed?: boolean };
  if (!validAnalysis(body.analysis) || !["live", "demo"].includes(body.sourceMode ?? "") || !body.restaurant || !body.knowledge || !body.reviewConfirmed || !body.restaurantConfirmed || !body.language || !SUPPORTED_LANGUAGES.includes(body.language)) {
    return Response.json({ error: "review_and_restaurant_confirmation_required" }, { status: 400, headers: cors });
  }
  let restaurantInput: ReturnType<typeof normalizePublicationRestaurant>;
  let dishRecord: ReturnType<typeof preparePublishedDish>;
  try {
    if (body.restaurant.provider === "google") {
      try { await enforceUsageBudget("places", identity.id); }
      catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
      const provider = createPlacesProvider(await placesApiKey());
      const place = await provider.restaurantDetails(body.restaurant.providerPlaceId ?? "", body.language);
      restaurantInput = normalizePublicationRestaurant({ provider: "google", providerPlaceId: place.providerPlaceId, name: place.displayName, latitude: place.latitude, longitude: place.longitude, locality: place.locality, administrativeRegion: place.administrativeRegion, countryCode: place.countryCode, address: place.address, currencyCode: place.currencyCode });
    } else restaurantInput = normalizePublicationRestaurant(body.restaurant);
    dishRecord = preparePublishedDish({ analysis: body.analysis, sourceMode: body.sourceMode!, knowledge: body.knowledge, language: body.language, restaurant: restaurantInput });
  } catch (error) {
    const status = error instanceof PlacesProviderError ? error.status : 400;
    const code = error instanceof PlacesProviderError ? error.code : error instanceof Error ? error.message : "invalid_publication";
    return Response.json({ error: code }, { status, headers: cors });
  }
  let imageKey: string | null = null;
  try { imageKey = body.imageDataUrl && body.retainImage === true ? await storeDishImage(body.imageDataUrl, identity.id) : null; }
  catch (error) { const code = error instanceof Error ? error.message : "invalid_image"; return Response.json({ error: code }, { status: code === "uploads_unavailable" ? 503 : 400, headers: cors }); }
  const id = crypto.randomUUID();
  const db = await getDb();
  if (body.retainImage === true) {
    const consentNow = new Date().toISOString();
    await db.insert(userConsents).values({ userId: identity.id, imageRetentionConsent: true, consentedAt: consentNow, updatedAt: consentNow }).onConflictDoUpdate({ target: userConsents.userId, set: { imageRetentionConsent: true, consentedAt: consentNow, withdrawnAt: null, updatedAt: consentNow } });
  }
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
  const dish = { id, ownerId: identity.id, contributorId: identity.id, restaurantId, sourceMode: body.sourceMode, ...body.analysis, ...dishRecord, restaurant: { ...restaurantInput, id: restaurantId }, imageKey, imageUrl: imageKey ? `/api/media/${imageKey}` : null };
  let matches = { confirmedNearbyDishes: [], communityOrInferredDishes: [], restaurantLevelAlternatives: [] } as ReturnType<typeof matchNearby>;
  let matchingStatus: { status: "live" | "unavailable"; code?: string; message?: string } = { status: "live" };
  let restaurantAlternatives: RestaurantPlace[] = [];
  let providerStatus: { status: "live" | "unavailable"; code?: string; message?: string } = { status: "live" };
  try {
    const provider = createPlacesProvider(await placesApiKey());
    const resolved = await provider.resolveCoordinates(restaurantInput.latitude, restaurantInput.longitude, body.language);
    restaurantAlternatives = await provider.nearbyRestaurants(resolved, { language: body.language, radiusMeters: 10_000 });
    restaurantAlternatives = restaurantAlternatives.filter((place) => place.providerPlaceId !== restaurantInput.providerPlaceId);
  } catch (error) {
    const providerError = error instanceof PlacesProviderError ? error : new PlacesProviderError("unavailable", "Live restaurant alternatives are unavailable.");
    providerStatus = { status: "unavailable", code: providerError.code, message: providerError.message };
  }
  try {
    const candidateRows = await db.select({ dish: publishedDishes, restaurant: restaurants }).from(publishedDishes).innerJoin(restaurants, eq(publishedDishes.restaurantId, restaurants.id)).where(and(eq(publishedDishes.countryCode, restaurantInput.countryCode), ne(publishedDishes.id, id))).orderBy(desc(publishedDishes.createdAt)).limit(200);
    const candidates: PublishedDishCandidate[] = candidateRows.flatMap(({ dish: candidate, restaurant }) => {
      if (candidate.latitude == null || candidate.longitude == null || !candidate.countryCode) return [];
      return [{ id: candidate.id, name: candidate.name, originalName: candidate.originalName, cuisine: candidate.cuisine, ingredients: candidate.ingredients, dietary: candidate.dietary, description: candidate.description, canonicalCuisine: candidate.canonicalCuisine, canonicalIngredients: parseConcepts(candidate.canonicalIngredients), canonicalFlavours: parseConcepts(candidate.canonicalFlavours), provenance: candidate.provenance, verificationStatus: candidate.verificationStatus, availabilityKnowledge: candidate.availabilityKnowledge, lastConfirmedAt: candidate.lastConfirmedAt, createdAt: candidate.createdAt, latitude: candidate.latitude, longitude: candidate.longitude, countryCode: candidate.countryCode, priceAmount: candidate.priceAmount, currencyCode: candidate.currencyCode, imageUrl: candidate.imageKey ? `/api/media/${candidate.imageKey}` : null, restaurant: { id: restaurant.id, name: restaurant.name, locality: restaurant.locality, address: restaurant.address } }];
    });
    matches = matchNearby({ analysis: body.analysis, location: { latitude: restaurantInput.latitude, longitude: restaurantInput.longitude, countryCode: restaurantInput.countryCode }, dishes: candidates, restaurantAlternatives });
  } catch {
    matchingStatus = { status: "unavailable", code: "dish_records_unavailable", message: "Published dish matching is temporarily unavailable; no demo results were substituted." };
  }
  return Response.json({ dish, matches, matchMode: "live", matchingStatus, providerStatus }, { status: 201, headers: cors });
}

function validAnalysis(value?: DishAnalysis): value is DishAnalysis {
  return Boolean(value && value.name?.trim() && value.cuisine?.trim() && value.ingredients?.trim() && value.dietary?.trim() && value.description?.trim() && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100 && value.canonical?.dishName?.trim() && value.canonical?.cuisine?.trim() && Array.isArray(value.canonical.ingredients) && Array.isArray(value.canonical.flavours) && ["ai_normalized", "user_reviewed"].includes(value.canonical.metadataSource));
}

function parseConcepts(value: string | null): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : []; }
  catch { return []; }
}
