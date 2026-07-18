import { getRuntimeEnv } from "./runtime-env.ts";

export async function corsHeaders(request: Request, methods: string): Promise<Headers> {
  const headers = new Headers({ "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id", "Access-Control-Allow-Methods": methods, "Vary": "Origin" });
  const origin = request.headers.get("origin");
  if (!origin) return headers;
  const env = await getRuntimeEnv() as Record<string, unknown>;
  const configured = String(env.TRINQUE_ALLOWED_ORIGINS ?? process.env.TRINQUE_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const sameOrigin = origin === new URL(request.url).origin;
  if (sameOrigin || configured.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export async function corsPreflight(request: Request, methods: string): Promise<Response> {
  const headers = await corsHeaders(request, methods);
  const origin = request.headers.get("origin");
  if (origin && !headers.has("Access-Control-Allow-Origin")) return new Response(null, { status: 403, headers });
  return new Response(null, { status: 204, headers });
}
