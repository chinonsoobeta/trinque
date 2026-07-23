import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!await requireIdentity(request)) return Response.json({ error: "authentication_required", code: "authentication_required" }, { status: 401 });
  const code = (await params).code;
  const db = await getDb();
  const [group] = await db.select({ name: groups.name, eventTime: groups.eventTime, locality: groups.locality, countryCode: groups.countryCode, timeZone: groups.timeZone, inviteExpiresAt: groups.inviteExpiresAt }).from(groups).where(and(eq(groups.inviteCode, code), isNull(groups.inviteRevokedAt), gt(groups.inviteExpiresAt, new Date().toISOString()))).limit(1);
  return group ? Response.json({ invite: group }) : Response.json({ error: "invite_expired_or_revoked" }, { status: 410 });
}
