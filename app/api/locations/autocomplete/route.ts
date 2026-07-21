import { placesApiKey } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { PlacesProviderError } from "@/lib/places/types";
import { supportedCountry, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";
const headers = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };

export function OPTIONS() { return new Response(null, { status: 204, headers }); }

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: { code: "session_required", message: "A guest session is required." } }, { status: 401 });
  try { await enforceUsageBudget("places", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
  let body: { input?: string; providerPlaceId?: string; latitude?: number; longitude?: number; language?: SupportedLanguage; location?: { latitude?: number; longitude?: number; countryCode?: string } | null };
  try { body = await request.json(); }
  catch { return providerError(new PlacesProviderError("invalid_request", "A JSON request body is required.", 400)); }
  const language = body.language && SUPPORTED_LANGUAGES.includes(body.language) ? body.language : "en-CA";
  try {
    const provider = createPlacesProvider(await placesApiKey());
    if (body.providerPlaceId) return Response.json({ location: await provider.resolveLocation(body.providerPlaceId, language), attribution: "Google Maps" }, { headers });
    if (typeof body.latitude === "number" && typeof body.longitude === "number") {
      return Response.json({ location: await provider.resolveCoordinates(body.latitude, body.longitude, language), attribution: "Google Maps" }, { headers });
    }
    if (typeof body.input === "string") {
      const location = body.location && typeof body.location.latitude === "number" && typeof body.location.longitude === "number"
        ? { latitude: body.location.latitude, longitude: body.location.longitude }
        : null;
      const countryCode = supportedCountry(body.location?.countryCode);
      return Response.json({ suggestions: await provider.autocomplete(body.input, { language, location, countryCode }), attribution: "Google Maps" }, { headers });
    }
    throw new PlacesProviderError("invalid_request", "Provide search text, a provider place ID, or coordinates.", 400);
  } catch (error) {
    return providerError(error instanceof PlacesProviderError ? error : new PlacesProviderError("unavailable", "Live location search is unavailable.", 503));
  }
}

function providerError(error: PlacesProviderError) {
  return Response.json({ suggestions: [], error: { code: error.code, message: error.message } }, { status: error.status, headers });
}
