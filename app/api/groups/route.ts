import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupMembers, groups, publishedDishes, restaurants } from "@/db/schema";
import { distanceBetween } from "@/lib/dish-matching";
import { groupSnapshot } from "@/lib/group-api";
import { DIETARY_REQUIREMENTS, instantForLocalTime, rankGroupCandidates, type DietaryRequirement, type GroupCandidateSource } from "@/lib/group-planning";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";
import { normalizeLocation, type NormalizedLocation } from "@/lib/location";
import { placesApiKey } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { PlacesProviderError } from "@/lib/places/types";
import { SUPPORTED_LANGUAGES, type SupportedCurrency, type SupportedLanguage } from "@/lib/regions";
import { enforceUsageBudget, UsageBudgetError } from "@/lib/operations";

export const runtime = "edge";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "authentication_required", code: "authentication_required" }, { status: 401 });
  const db = await getDb();
  const [latest] = await db.select({ id: groups.id }).from(groupMembers).innerJoin(groups, eq(groupMembers.groupId, groups.id)).where(eq(groupMembers.userId, identity.id)).orderBy(desc(groupMembers.joinedAt)).limit(1);
  return Response.json({ group: latest ? await groupSnapshot(latest.id, identity.id) : null });
}

export async function POST(request: Request) {
  let identity;
  try { identity = await requireOnboardedIdentity(request); }
  catch (error) {
    const authenticationError = error instanceof AuthenticationError ? error : null;
    const code = authenticationError?.status === 403 && authenticationError.message === "Complete your profile first."
      ? "profile_incomplete"
      : "authentication_required";
    return Response.json({ error: code, code }, { status: authenticationError?.status ?? 503 });
  }
  const body = await request.json() as { name?: string; eventTime?: string; eventLocalDate?: string; eventLocalTime?: string; budgetMax?: number; maxDistanceKm?: number; maxDistance?: number; distanceUnit?: "metric" | "imperial"; allergies?: string[]; dietaryRequirements?: string[]; cuisineTypes?: string[]; location?: NormalizedLocation; language?: SupportedLanguage };
  if (!body.location || !body.language || !SUPPORTED_LANGUAGES.includes(body.language)) return Response.json({ error: "normalized_group_location_required" }, { status: 400 });
  let location: NormalizedLocation;
  try { location = normalizeLocation({ ...body.location, source: body.location.source ?? "manual" }, body.language); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "invalid_location" }, { status: 400 }); }
  const distanceUnit = body.distanceUnit === "imperial" ? "imperial" : "metric";
  const requestedDistance = Number(body.maxDistance ?? body.maxDistanceKm) || 4;
  const constraints = { budgetMax: clamp(Math.round(Number(body.budgetMax) || 35), 10, 500), maxDistanceKm: clamp(Math.round(requestedDistance * (distanceUnit === "imperial" ? 1.609344 : 1)), 1, 80), allergies: (body.allergies ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 10), dietaryRequirements: (body.dietaryRequirements ?? []).filter((item): item is DietaryRequirement => DIETARY_REQUIREMENTS.includes(item as DietaryRequirement)).slice(0, DIETARY_REQUIREMENTS.length), cuisineTypes: (body.cuisineTypes ?? []).map((item) => item.trim().toLocaleLowerCase()).filter(Boolean).slice(0, 10) };
  let eventTime: Date;
  try { eventTime = body.eventLocalDate && body.eventLocalTime ? instantForLocalTime(body.eventLocalDate, body.eventLocalTime, location.timeZone) : new Date(body.eventTime ?? Date.now() + 86400000); }
  catch { return Response.json({ error: "invalid_event_time", code: "invalid_event_time" }, { status: 400 }); }
  if (Number.isNaN(eventTime.getTime())) return Response.json({ error: "invalid_event_time", code: "invalid_event_time" }, { status: 400 });
  const db = await getDb();
  const dishRows = await db.select({ dish: publishedDishes, restaurant: restaurants }).from(publishedDishes).innerJoin(restaurants, eq(publishedDishes.restaurantId, restaurants.id)).where(eq(publishedDishes.countryCode, location.countryCode)).orderBy(desc(publishedDishes.createdAt)).limit(200);
  const sources: GroupCandidateSource[] = dishRows.flatMap(({ dish, restaurant }) => {
    if (dish.latitude == null || dish.longitude == null || dish.provenance === "seed_demo" || dish.verificationStatus === "disputed") return [];
    const distanceKm = distanceBetween(location, { latitude: dish.latitude, longitude: dish.longitude });
    if (distanceKm > constraints.maxDistanceKm * 2) return [];
    return [{ candidateId: dish.id, name: dish.originalName ?? dish.name, restaurant: restaurant.name, neighborhood: restaurant.locality, distanceKm, priceAmount: dish.priceAmount, currencyCode: dish.currencyCode ?? location.currencyCode, image: dish.imageKey ? `/api/media/${dish.imageKey}` : null, dietaryCaveat: dish.dietary, cuisine: dish.cuisine, kind: "published_dish", restaurantId: restaurant.id, providerPlaceId: restaurant.providerPlaceId, provenance: dish.provenance, verificationStatus: dish.verificationStatus, currentAvailabilityConfirmed: dish.availabilityKnowledge === "recently_confirmed" && Boolean(dish.lastConfirmedAt) }];
  });
  let providerStatus: { status: "live" | "unavailable"; code?: string } = { status: "live" };
  try {
    await enforceUsageBudget("places", identity.id);
    const provider = createPlacesProvider(await placesApiKey());
    const places = await provider.nearbyRestaurants(location, { language: body.language, radiusMeters: Math.min(50_000, constraints.maxDistanceKm * 1000) });
    const existingIds = new Set(sources.map((source) => source.providerPlaceId).filter(Boolean));
    for (const place of places.filter((item) => !existingIds.has(item.providerPlaceId)).slice(0, 10)) sources.push({ candidateId: `google:${place.providerPlaceId}`, name: "Restaurant-level alternative", restaurant: place.displayName, neighborhood: place.locality, distanceKm: place.distanceKm ?? distanceBetween(location, place), priceAmount: null, currencyCode: place.currencyCode, image: null, dietaryCaveat: "provider_information_unconfirmed", kind: "provider_restaurant", providerPlaceId: place.providerPlaceId, provenance: "provider_place", verificationStatus: "not_applicable", currentAvailabilityConfirmed: false });
  } catch (error) { providerStatus = { status: "unavailable", code: error instanceof UsageBudgetError ? "rate_limit" : error instanceof PlacesProviderError ? error.code : "unavailable" }; }
  const ranked = rankGroupCandidates(sources, constraints, location.locale);
  const id = crypto.randomUUID();
  const now = new Date();
  const inviteExpiresAt = new Date(now.getTime() + 7 * 86400000).toISOString();
  await db.insert(groups).values({ id, ownerId: identity.id, name: body.name?.trim().slice(0, 80) || "Friday supper", eventTime: eventTime.toISOString(), eventLocalDate: body.eventLocalDate ?? null, eventLocalTime: body.eventLocalTime ?? null, neighborhood: location.locality, ...constraints, distanceUnit, allergies: JSON.stringify(constraints.allergies), dietaryRequirements: JSON.stringify(constraints.dietaryRequirements), cuisineTypes: JSON.stringify(constraints.cuisineTypes), inviteCode: crypto.randomUUID().replace(/-/g, "").slice(0, 12), inviteExpiresAt, latitude: location.latitude, longitude: location.longitude, locality: location.locality, administrativeRegion: location.administrativeRegion, countryCode: location.countryCode, currencyCode: location.currencyCode as SupportedCurrency, timeZone: location.timeZone, locale: location.locale, displayLanguage: body.language, updatedAt: now.toISOString() });
  await db.insert(groupMembers).values({ groupId: id, userId: identity.id, role: "owner", language: body.language });
  for (const candidate of ranked) await db.insert(groupCandidates).values({ groupId: id, candidateId: candidate.candidateId, name: candidate.name, restaurant: candidate.restaurant, neighborhood: candidate.neighborhood, distanceKm: candidate.distanceKm, price: candidate.price, image: candidate.image, score: candidate.score, eligible: candidate.eligible, explanation: candidate.explanation, conflicts: JSON.stringify(candidate.conflicts), kind: candidate.kind, restaurantId: candidate.restaurantId, providerPlaceId: candidate.providerPlaceId, priceAmount: candidate.priceAmount, currencyCode: candidate.currencyCode as SupportedCurrency, provenance: candidate.provenance, verificationStatus: candidate.verificationStatus, currentAvailabilityConfirmed: candidate.currentAvailabilityConfirmed, dietaryCaveat: candidate.dietaryCaveat });
  return Response.json({ group: await groupSnapshot(id, identity.id), providerStatus }, { status: 201 });
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
