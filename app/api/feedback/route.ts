import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { feedbackReports } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { SUPPORTED_COUNTRY_CODES, type SupportedCountry } from "@/lib/regions";

export const runtime = "edge";
const reasons = ["wrong_identification", "stale_dish", "closed_restaurant"] as const;
const targets = ["analysis", "published_dish", "restaurant"] as const;

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const db = await getDb();
  const reports = await db.select().from(feedbackReports).where(eq(feedbackReports.userId, identity.id)).orderBy(desc(feedbackReports.createdAt)).limit(100);
  return Response.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  let body: { reason?: string; targetType?: string; targetId?: string | null; comment?: string; countryCode?: SupportedCountry };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_feedback" }, { status: 400 }); }
  if (!reasons.includes(body.reason as typeof reasons[number]) || !targets.includes(body.targetType as typeof targets[number])) return Response.json({ error: "invalid_feedback" }, { status: 400 });
  if (body.targetId !== undefined && body.targetId !== null && (typeof body.targetId !== "string" || body.targetId.length > 160)) return Response.json({ error: "invalid_feedback" }, { status: 400 });
  if (body.comment !== undefined && (typeof body.comment !== "string" || body.comment.trim().length > 1_000)) return Response.json({ error: "invalid_feedback" }, { status: 400 });
  if (body.countryCode !== undefined && !SUPPORTED_COUNTRY_CODES.includes(body.countryCode)) return Response.json({ error: "invalid_feedback" }, { status: 400 });
  const report = { id: crypto.randomUUID(), userId: identity.id, reason: body.reason as typeof reasons[number], targetType: body.targetType as typeof targets[number], targetId: body.targetId?.trim() || null, comment: body.comment?.trim() || null, countryCode: body.countryCode ?? null, status: "open" as const };
  const db = await getDb();
  await db.insert(feedbackReports).values(report);
  const [saved] = await db.select().from(feedbackReports).where(and(eq(feedbackReports.id, report.id), eq(feedbackReports.userId, identity.id))).limit(1);
  return Response.json({ report: saved }, { status: 201 });
}
