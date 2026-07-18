/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { logOperation, requestIdFor } from "../lib/operations";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APPLE_DEVELOPER_TEAM_ID?: string;
  TRINQUE_ALLOWED_ORIGINS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const requestId = requestIdFor(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("X-Request-Id", requestId);
    const routedRequest = new Request(request, { headers: requestHeaders });
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigins = String(env.TRINQUE_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const originAllowed = Boolean(origin && (origin === url.origin || allowedOrigins.includes(origin)));

    if (request.method === "OPTIONS" && origin) {
      if (!originAllowed) return observed(new Response(null, { status: 403 }), requestId, startedAt, origin, false);
      return observed(new Response(null, { status: 204, headers: { "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" } }), requestId, startedAt, origin, true);
    }

    if (url.pathname === "/.well-known/apple-app-site-association") {
      const teamId = String(env.APPLE_DEVELOPER_TEAM_ID ?? "").trim();
      const response = teamId
        ? Response.json({ applinks: { apps: [], details: [{ appID: `${teamId}.com.chinonsoobeta.trinque`, components: [{ "/": "/", "?": { join: "*" }, comment: "Trinque group invite links" }] }] } }, { headers: { "Cache-Control": "public, max-age=300" } })
        : Response.json({ error: "apple_team_id_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
      return observed(response, requestId, startedAt, origin, originAllowed);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(routedRequest, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return observed(response, requestId, startedAt, origin, originAllowed);
    }

    return observed(await handler.fetch(routedRequest, env, ctx), requestId, startedAt, origin, originAllowed);
  },
};

function observed(response: Response, requestId: string, startedAt: number, origin: string | null, originAllowed: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.append("Vary", "Origin");
  if (origin && originAllowed) headers.set("Access-Control-Allow-Origin", origin);
  logOperation("http_request", { requestId, action: "http", status: response.status, durationMs: Date.now() - startedAt });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default worker;
