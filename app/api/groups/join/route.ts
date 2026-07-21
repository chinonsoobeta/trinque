import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";

export const runtime = "edge";

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  let identity;
  try { identity = await requireOnboardedIdentity(request); }
  catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "authentication_required" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
  try { await enforceUsageBudget("invite_join", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
  const body = await request.json() as { inviteCode?: string; language?: SupportedLanguage };
  if (!body.inviteCode?.trim() || !body.language || !SUPPORTED_LANGUAGES.includes(body.language)) return Response.json({ error: "valid_invite_required" }, { status: 400 });
  const db = await getDb();
  const [group] = await db.select().from(groups).where(and(eq(groups.inviteCode, body.inviteCode.trim()), isNull(groups.inviteRevokedAt), gt(groups.inviteExpiresAt, new Date().toISOString()))).limit(1);
  if (!group) return Response.json({ error: "invite_expired_or_revoked" }, { status: 410 });
  await db.insert(groupMembers).values({ groupId: group.id, userId: identity.id, role: group.ownerId === identity.id ? "owner" : "participant", language: body.language }).onConflictDoUpdate({ target: [groupMembers.groupId, groupMembers.userId], set: { language: body.language } });
  return Response.json({ group: await groupSnapshot(group.id, identity.id) });
}
