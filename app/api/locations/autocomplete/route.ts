import { getRuntimeEnv, selectGooglePlacesKey } from "@/lib/runtime-env";
import { GoogleLocationProvider } from "@/lib/places/google-location";
import { PlacesProviderError } from "@/lib/places/types";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";

export const runtime = "edge";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };

export function OPTIONS() { return new Response(null, { status: 204, headers }); }

export async function POST(request: Request) {
  const env = await getRuntimeEnv();
  const apiKey = selectGooglePlacesKey(env.GOOGLE_PLACES_API_KEY, process.env.GOOGLE_PLACES_API_KEY);
  if (!apiKey) return providerError(new PlacesProviderError("credentials", "Live restaurant discovery is not configured.", 503));
  let body: { input?: string; providerPlaceId?: string; latitude?: number; longitude?: number; language?: SupportedLanguage; location?: { latitude?: number; longitude?: number } | null };
  try { body = await request.json(); }
  catch { return providerError(new PlacesProviderError("invalid_request", "A JSON request body is required.", 400)); }
  const language = body.language && SUPPORTED_LANGUAGES.includes(body.language) ? body.language : "en-CA";
  const provider = new GoogleLocationProvider(apiKey);
  try {
    if (body.providerPlaceId) return Response.json({ location: await provider.resolveLocation(body.providerPlaceId, language), attribution: "Google Maps" }, { headers });
    if (typeof body.latitude === "number" && typeof body.longitude === "number") {
      return Response.json({ location: await provider.resolveCoordinates(body.latitude, body.longitude, language), attribution: "Google Maps" }, { headers });
    }
    if (typeof body.input === "string") {
      const location = body.location && typeof body.location.latitude === "number" && typeof body.location.longitude === "number"
        ? { latitude: body.location.latitude, longitude: body.location.longitude }
        : null;
      return Response.json({ suggestions: await provider.autocomplete(body.input, { language, location }), attribution: "Google Maps" }, { headers });
    }
    throw new PlacesProviderError("invalid_request", "Provide search text, a provider place ID, or coordinates.", 400);
  } catch (error) {
    return providerError(error instanceof PlacesProviderError ? error : new PlacesProviderError("unavailable", "Live location search is unavailable.", 503));
  }
}

function providerError(error: PlacesProviderError) {
  return Response.json({ suggestions: [], error: { code: error.code, message: error.message } }, { status: error.status, headers });
}
