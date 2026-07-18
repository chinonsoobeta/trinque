import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { requireIdentity } from "@/lib/identity";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";

export const runtime = "edge";

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const body = await request.json() as { inviteCode?: string; language?: SupportedLanguage };
  if (!body.inviteCode?.trim() || !body.language || !SUPPORTED_LANGUAGES.includes(body.language)) return Response.json({ error: "valid_invite_required" }, { status: 400 });
  const db = await getDb();
  const [group] = await db.select().from(groups).where(and(eq(groups.inviteCode, body.inviteCode.trim()), isNull(groups.inviteRevokedAt), gt(groups.inviteExpiresAt, new Date().toISOString()))).limit(1);
  if (!group) return Response.json({ error: "invite_expired_or_revoked" }, { status: 410 });
  await db.insert(groupMembers).values({ groupId: group.id, userId: identity.id, role: group.ownerId === identity.id ? "owner" : "participant", language: body.language }).onConflictDoUpdate({ target: [groupMembers.groupId, groupMembers.userId], set: { language: body.language } });
  return Response.json({ group: await groupSnapshot(group.id, identity.id) });
}
