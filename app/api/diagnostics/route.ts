import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientErrorReports, userConsents } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";
const kinds = ["js_exception", "unhandled_rejection", "api_error"] as const;

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ recorded: false }, { status: 401 });
  let body: { kind?: string; code?: string; platform?: string; appVersion?: string; route?: string | null };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_diagnostic" }, { status: 400 }); }
  if (!kinds.includes(body.kind as typeof kinds[number]) || !["ios", "web"].includes(body.platform ?? "") || typeof body.appVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(body.appVersion) || typeof body.code !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.code) || (body.route !== undefined && body.route !== null && (typeof body.route !== "string" || !/^\/(?:[A-Za-z0-9/_-]{0,120})$/.test(body.route)))) return Response.json({ error: "invalid_diagnostic" }, { status: 400 });
  const db = await getDb();
  const [consent] = await db.select({ analyticsConsent: userConsents.analyticsConsent }).from(userConsents).where(eq(userConsents.userId, identity.id)).limit(1);
  if (!consent?.analyticsConsent) return Response.json({ recorded: false }, { status: 202 });
  await db.insert(clientErrorReports).values({ id: crypto.randomUUID(), userId: identity.id, kind: body.kind as typeof kinds[number], code: body.code, platform: body.platform as "ios" | "web", appVersion: body.appVersion, route: body.route ?? null });
  return Response.json({ recorded: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
