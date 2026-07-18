import { capabilityStatus } from "@/lib/readiness";

export const runtime = "edge";

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");
    const capabilities = capabilityStatus({
      openAIKey: process.env.OPENAI_API_KEY,
      hasDatabase: Boolean(env.DB),
      hasUploads: Boolean(env.UPLOADS),
    });
    return Response.json({ ok: true, ...capabilities }, {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return Response.json({
      ok: false,
      ...capabilityStatus({ openAIKey: process.env.OPENAI_API_KEY, hasDatabase: false, hasUploads: false }),
    }, { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  }
}
