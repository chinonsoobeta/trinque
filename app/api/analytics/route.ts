import { parseAnalyticsInput, recordConsentedAnalytics } from "@/lib/analytics";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "invalid_event" }, { status: 400 }); }
  const parsed = parseAnalyticsInput(input);
  if (!parsed) return Response.json({ error: "invalid_event" }, { status: 400 });
  const recorded = await recordConsentedAnalytics(identity.id, parsed);
  return Response.json({ recorded }, { status: recorded ? 201 : 202, headers: { "Cache-Control": "no-store" } });
}
