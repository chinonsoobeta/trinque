import {
  AuthenticationError,
  clearedSessionCookie,
  createSessionFromSupabase,
  getOptionalIdentity,
  revokeAppSession,
  sessionCookie,
} from "@/lib/auth";

export const runtime = "edge";

const cors = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  const identity = await getOptionalIdentity(request);
  return Response.json({ authenticated: Boolean(identity && identity.authType !== "guest"), identity }, { headers: cors });
}

export async function POST(request: Request) {
  try {
    const { identity, token, expiresAt } = await createSessionFromSupabase(request);
    const headers = new Headers(cors);
    headers.set("Set-Cookie", sessionCookie(request, token, expiresAt));
    return Response.json({ authenticated: true, identity, sessionToken: token, expiresAt }, { status: 201, headers });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    const message = error instanceof AuthenticationError ? error.message : "Unable to establish app session.";
    return Response.json({ authenticated: false, error: message }, { status, headers: cors });
  }
}

export async function DELETE(request: Request) {
  await revokeAppSession(request);
  const headers = new Headers(cors);
  headers.set("Set-Cookie", clearedSessionCookie(request));
  return Response.json({ ok: true }, { headers });
}
