import { placesApiKey, placesErrorResponse, placesResponseHeaders } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const requestedLanguage = new URL(request.url).searchParams.get("language") as SupportedLanguage | null;
  const language = requestedLanguage && SUPPORTED_LANGUAGES.includes(requestedLanguage) ? requestedLanguage : "en-CA";
  try {
    const provider = createPlacesProvider(await placesApiKey());
    const restaurant = await provider.restaurantDetails(providerId, language);
    return Response.json({ restaurant, attribution: "Google Maps" }, { headers: placesResponseHeaders });
  } catch (error) { return placesErrorResponse(error); }
}
