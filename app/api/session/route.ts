import { getOrCreateLegacyIdentity, sessionCookie } from "@/lib/auth";

export const runtime = "edge";

const headers = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };

export function OPTIONS() { return new Response(null, { status: 204, headers }); }

export async function POST(request: Request) {
  try {
    const session = await getOrCreateLegacyIdentity(request);
    const responseHeaders = new Headers(headers);
    if (session.sessionToken && session.expiresAt) responseHeaders.set("Set-Cookie", sessionCookie(request, session.sessionToken, session.expiresAt));
    return Response.json({ ok: true, ...session }, { status: session.guestToken ? 201 : 200, headers: responseHeaders });
  } catch {
    return Response.json({ ok: false, error: "session_persistence_unavailable", code: "session_persistence_unavailable" }, { status: 503, headers });
  }
}
