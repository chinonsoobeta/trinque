import { NextResponse, type NextRequest } from "next/server";

// Replaces the request-envelope work the Cloudflare Worker used to do: a stable
// request id on every response, and an origin allow-list for browser CORS.
export function proxy(request: NextRequest) {
  const requestId = requestIdFor(request);
  const origin = request.headers.get("origin");
  const originAllowed = isOriginAllowed(origin, selfOrigin(request));

  if (request.method === "OPTIONS" && origin) {
    if (!originAllowed) return decorate(new NextResponse(null, { status: 403 }), requestId, origin, false);
    const preflight = new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
    return decorate(preflight, requestId, origin, true);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Request-Id", requestId);
  return decorate(NextResponse.next({ request: { headers: requestHeaders } }), requestId, origin, originAllowed);
}

function requestIdFor(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : crypto.randomUUID();
}

// `nextUrl.origin` reflects the configured deployment URL rather than the host
// the browser actually asked for, so same-origin has to come from the headers.
function selfOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const protocol = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

function isOriginAllowed(origin: string | null, self: string): boolean {
  if (!origin) return false;
  if (origin === self) return true;
  return String(process.env.TRINQUE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin);
}

function decorate(response: NextResponse, requestId: string, origin: string | null, originAllowed: boolean): NextResponse {
  response.headers.set("X-Request-Id", requestId);
  response.headers.append("Vary", "Origin");
  if (origin && originAllowed) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
