import { NextResponse, type NextRequest } from "next/server";
import { logOperation, requestIdFor } from "@/lib/request-log";

/**
 * The request envelope the Cloudflare Worker used to provide: a request id on
 * every request and response, CORS limited to the deployment's own origin plus
 * explicitly configured browser origins, and one structured log line per
 * request.
 */
export function proxy(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  const origin = request.headers.get("origin");
  const originAllowed = isOriginAllowed(origin, selfOrigin(request));

  const legacy = legacyRootDestination(request);
  if (legacy) {
    const url = request.nextUrl.clone();
    const [pathname, search = ""] = legacy.split("?");
    url.pathname = pathname;
    url.search = search;
    return decorate(NextResponse.redirect(url), requestId, startedAt, origin, originAllowed);
  }

  if (request.method === "OPTIONS" && origin) {
    if (!originAllowed) return decorate(new NextResponse(null, { status: 403 }), requestId, startedAt, origin, false);
    return decorate(new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    }), requestId, startedAt, origin, true);
  }

  const headers = new Headers(request.headers);
  headers.set("X-Request-Id", requestId);
  return decorate(NextResponse.next({ request: { headers } }), requestId, startedAt, origin, originAllowed);
}

/**
 * `/` used to host Discover, Groups and Saved behind a `?view=` parameter, and
 * invitations were shared as `/?join=CODE`. Those links are in the wild, so
 * they still have to reach the routes that replaced them.
 */
function legacyRootDestination(request: NextRequest): string | null {
  if (request.nextUrl.pathname !== "/") return null;
  const join = request.nextUrl.searchParams.get("join");
  if (join) return `/groups?join=${encodeURIComponent(join)}`;
  const view = request.nextUrl.searchParams.get("view");
  if (view === "groups") return "/groups";
  if (view === "saved") return "/saved";
  if (view === "explore") return "/explore";
  return null;
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

/**
 * `nextUrl.origin` reflects the configured deployment URL rather than the host
 * the browser actually asked for, so same-origin has to come from the headers.
 */
function selfOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const localhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = request.headers.get("x-forwarded-proto") ?? (localhost ? "http" : "https");
  return `${protocol}://${host}`;
}

function decorate(response: NextResponse, requestId: string, startedAt: number, origin: string | null, originAllowed: boolean): NextResponse {
  response.headers.set("X-Request-Id", requestId);
  response.headers.append("Vary", "Origin");
  if (origin && originAllowed) response.headers.set("Access-Control-Allow-Origin", origin);
  logOperation("http_request", { requestId, action: "http", status: response.status, durationMs: Date.now() - startedAt });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
