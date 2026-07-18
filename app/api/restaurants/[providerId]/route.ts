import { placesApiKey, placesErrorResponse, placesResponseHeaders } from "@/lib/places/http";
import { createPlacesProvider } from "@/lib/places/provider";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const requestId = requestIdFor(request);
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: { code: "session_required", message: "A guest session is required." } }, { status: 401 });
  try { await enforceUsageBudget("places", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
  const { providerId } = await params;
  const requestedLanguage = new URL(request.url).searchParams.get("language") as SupportedLanguage | null;
  const language = requestedLanguage && SUPPORTED_LANGUAGES.includes(requestedLanguage) ? requestedLanguage : "en-CA";
  try {
    const provider = createPlacesProvider(await placesApiKey());
    const restaurant = await provider.restaurantDetails(providerId, language);
    return Response.json({ restaurant, attribution: "Google Maps" }, { headers: placesResponseHeaders });
  } catch (error) { return placesErrorResponse(error); }
}
