import { getOrCreateIdentity } from "@/lib/identity";

export const runtime = "edge";

const headers = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

export function OPTIONS() { return new Response(null, { status: 204, headers }); }

export async function POST(request: Request) {
  try {
    const session = await getOrCreateIdentity(request);
    return Response.json({ ok: true, ...session }, { status: session.guestToken ? 201 : 200, headers });
  } catch {
    return Response.json({ ok: false, error: "Guest persistence is temporarily unavailable." }, { status: 503, headers });
  }
}
