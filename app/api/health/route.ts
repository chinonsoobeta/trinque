import { databaseConfigured } from "@/db";
import { storageConfigured } from "@/lib/object-storage";
import { capabilityStatus } from "@/lib/readiness";
import { getRuntimeEnv, selectGooglePlacesKey, selectOpenAIKey } from "@/lib/runtime-env";


export async function GET() {
  try {
    const env = await getRuntimeEnv();
    const capabilities = capabilityStatus({
      openAIKey: selectOpenAIKey(
        env.OPENAI_API_KEY_2,
        env.OPENAI_API_KEY,
        process.env.OPENAI_API_KEY_2,
        process.env.OPENAI_API_KEY,
      ),
      googlePlacesKey: selectGooglePlacesKey(
        env.GCP_API_KEY,
        env.GOOGLE_PLACES_API_KEY,
        process.env.GCP_API_KEY,
        process.env.GOOGLE_PLACES_API_KEY,
      ),
      hasDatabase: databaseConfigured(),
      hasUploads: storageConfigured(),
    });
    return Response.json({ ok: true, ...capabilities }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({
      ok: false,
      ...capabilityStatus({
        openAIKey: selectOpenAIKey(
          undefined,
          undefined,
          process.env.OPENAI_API_KEY_2,
          process.env.OPENAI_API_KEY,
        ),
        googlePlacesKey: selectGooglePlacesKey(undefined, undefined, process.env.GCP_API_KEY, process.env.GOOGLE_PLACES_API_KEY),
        hasDatabase: false,
        hasUploads: false,
      }),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
