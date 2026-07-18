import { capabilityStatus } from "@/lib/readiness";
import { getRuntimeEnv, selectGooglePlacesKey, selectOpenAIKey } from "@/lib/runtime-env";

export const runtime = "edge";

export async function GET() {
  try {
    const env = await getRuntimeEnv();
    const capabilities = capabilityStatus({
      openAIKey: selectOpenAIKey(env.OPENAI_API_KEY, process.env.OPENAI_API_KEY),
      googlePlacesKey: selectGooglePlacesKey(env.GOOGLE_PLACES_API_KEY, process.env.GOOGLE_PLACES_API_KEY),
      hasDatabase: Boolean(env.DB),
      hasUploads: Boolean(env.UPLOADS),
    });
    return Response.json({ ok: true, ...capabilities }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({
      ok: false,
      ...capabilityStatus({ openAIKey: process.env.OPENAI_API_KEY, googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY, hasDatabase: false, hasUploads: false }),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
