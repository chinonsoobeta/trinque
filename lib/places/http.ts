import { getRuntimeEnv, selectGooglePlacesKey } from "../runtime-env.ts";
import { PlacesProviderError } from "./types.ts";

export const placesResponseHeaders = { "Cache-Control": "private, no-store" } as const;

export async function placesApiKey(): Promise<string> {
  const env = await getRuntimeEnv();
  const key = selectGooglePlacesKey(env.GOOGLE_PLACES_API_KEY, process.env.GOOGLE_PLACES_API_KEY);
  if (!key) throw new PlacesProviderError("credentials", "Live restaurant discovery is not configured.", 503);
  return key;
}

export function placesErrorResponse(error: unknown): Response {
  const providerError = error instanceof PlacesProviderError ? error : new PlacesProviderError("unavailable", "Live restaurant discovery is unavailable.", 503);
  return Response.json({ error: { code: providerError.code, message: providerError.message } }, { status: providerError.status, headers: placesResponseHeaders });
}
