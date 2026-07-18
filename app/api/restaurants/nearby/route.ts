import { normalizeLocation } from "@/lib/location";
import { placesApiKey, placesErrorResponse, placesResponseHeaders } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { PlacesProviderError } from "@/lib/places/types";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: { code: "session_required", message: "A guest session is required." } }, { status: 401 });
  try { await enforceUsageBudget("places", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
  const url = new URL(request.url);
  const rawLatitude = url.searchParams.get("latitude");
  const rawLongitude = url.searchParams.get("longitude");
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const radiusMeters = url.searchParams.has("radiusMeters") ? Number(url.searchParams.get("radiusMeters")) : 5_000;
  const requestedLanguage = url.searchParams.get("language") as SupportedLanguage | null;
  const language = requestedLanguage && SUPPORTED_LANGUAGES.includes(requestedLanguage) ? requestedLanguage : "en-CA";
  const dishName = (url.searchParams.get("dishName") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const cuisine = (url.searchParams.get("cuisine") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  if (rawLatitude === null || rawLongitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50_000) {
    return placesErrorResponse(new PlacesProviderError("invalid_request", "Valid coordinates and a radius from 100 to 50000 metres are required.", 400));
  }
  try {
    const provider = createPlacesProvider(await placesApiKey());
    const resolved = await provider.resolveCoordinates(latitude, longitude, language);
    const location = normalizeLocation({ ...resolved, latitude, longitude, source: "device" }, language);
    const dishQuery = dishName ? [dishName, cuisine, "restaurant"].filter(Boolean).join(" ") : undefined;
    const restaurants = await provider.nearbyRestaurants(location, { language, radiusMeters, dishQuery });
    return Response.json({
      location,
      restaurants,
      attribution: "Google Maps",
      queryMode: dishQuery ? "reviewed_dish" : "nearby",
      ranking: {
        factors: ["relevance", "distance", "prominence"],
        learnMoreUri: "https://support.google.com/business/answer/7091",
      },
    }, { headers: placesResponseHeaders });
  } catch (error) { return placesErrorResponse(error); }
}
