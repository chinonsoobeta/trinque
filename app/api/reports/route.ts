import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentReports } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";
import { enforceUsageBudget, UsageBudgetError } from "@/lib/operations";

export const runtime = "edge";
const targetTypes = ["user", "dish", "comment"] as const;
const reasons = ["harmful", "spam", "false", "stale", "other"] as const;

export async function GET(request: Request) {
  try { const identity = await requireAuthenticatedIdentity(request); const db = await getDb(); const reports = await db.select().from(contentReports).where(eq(contentReports.reporterId, identity.id)).orderBy(desc(contentReports.createdAt)).limit(100); return Response.json({ reports }); }
  catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "reports_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request); await enforceUsageBudget("report", identity.id);
    const body = await request.json() as { targetType?: string; targetId?: string; reason?: string; details?: string };
    if (!targetTypes.includes(body.targetType as typeof targetTypes[number]) || !body.targetId?.trim() || body.targetId.length > 160 || !reasons.includes(body.reason as typeof reasons[number]) || (body.details?.trim().length ?? 0) > 1000) return Response.json({ error: "invalid_report" }, { status: 400 });
    const report = { id: crypto.randomUUID(), reporterId: identity.id, targetType: body.targetType as typeof targetTypes[number], targetId: body.targetId.trim(), reason: body.reason as typeof reasons[number], details: body.details?.trim() ?? "", status: "open" as const };
    const db = await getDb(); await db.insert(contentReports).values(report);
    return Response.json({ report }, { status: 201 });
  } catch (error) { const status = error instanceof AuthenticationError ? error.status : error instanceof UsageBudgetError ? 429 : 503; return Response.json({ error: error instanceof AuthenticationError ? error.message : error instanceof UsageBudgetError ? "rate_limit" : "reports_unavailable" }, { status }); }
}
