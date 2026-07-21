import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, contentReports, moderationActions, publishedDishes } from "@/db/schema";
import { isModerator } from "@/lib/admin";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";

export const runtime = "edge";
const actions = ["hide", "remove", "restore", "resolve", "reject"] as const;

async function requireModerator(request: Request) {
  const identity = await requireAuthenticatedIdentity(request);
  if (!await isModerator(identity.id)) return null;
  return identity;
}

export async function GET(request: Request) {
  try {
    const identity = await requireModerator(request);
    if (!identity) return Response.json({ error: "moderator_required" }, { status: 403 });
    const db = await getDb();
    const reports = await db.select().from(contentReports).where(eq(contentReports.status, "open")).orderBy(desc(contentReports.createdAt)).limit(100);
    return Response.json({ reports });
  } catch (error) {
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "moderation_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await requireModerator(request);
    if (!identity) return Response.json({ error: "moderator_required" }, { status: 403 });
    const body = await request.json() as { reportId?: string; action?: string; reason?: string };
    if (!body.reportId?.trim() || !actions.includes(body.action as typeof actions[number]) || (body.reason?.trim().length ?? 0) > 1_000) return Response.json({ error: "invalid_moderation_action" }, { status: 400 });
    const db = await getDb();
    const [report] = await db.select().from(contentReports).where(eq(contentReports.id, body.reportId.trim())).limit(1);
    if (!report) return Response.json({ error: "report_not_found" }, { status: 404 });
    const action = body.action as typeof actions[number];
    if (action === "hide" || action === "remove" || action === "restore") {
      const status = action === "restore" ? "active" : action === "hide" ? "hidden" : "removed";
      if (report.targetType === "dish") await db.update(publishedDishes).set({ moderationStatus: status }).where(eq(publishedDishes.id, report.targetId));
      else if (report.targetType === "comment") await db.update(comments).set({ moderationStatus: status }).where(eq(comments.id, report.targetId));
      else return Response.json({ error: "user_moderation_not_available" }, { status: 400 });
    }
    await db.insert(moderationActions).values({ id: crypto.randomUUID(), reportId: report.id, adminId: identity.id, targetType: report.targetType, targetId: report.targetId, action, reason: body.reason?.trim() ?? "" });
    if (action === "resolve" || action === "reject" || action === "hide" || action === "remove" || action === "restore") await db.update(contentReports).set({ status: action === "reject" ? "rejected" : "resolved", resolvedAt: new Date().toISOString() }).where(and(eq(contentReports.id, report.id), eq(contentReports.status, "open")));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof AuthenticationError ? error.message : "moderation_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 });
  }
}
