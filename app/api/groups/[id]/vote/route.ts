import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupVotes, groups } from "@/db/schema";
import { groupMembership, groupSnapshot } from "@/lib/group-api";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const membership = await groupMembership(id, identity.id);
  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!membership || !group || group.status !== "voting") return Response.json({ error: "Open group plan not found." }, { status: 404 });
  const { candidateId } = await request.json() as { candidateId?: string };
  const [candidate] = await db.select().from(groupCandidates).where(and(eq(groupCandidates.groupId, id), eq(groupCandidates.candidateId, candidateId ?? ""))).limit(1);
  if (!candidate || !candidate.eligible) return Response.json({ error: "This candidate has an unresolved hard constraint." }, { status: 409 });
  await db.insert(groupVotes).values({ groupId: id, userId: identity.id, candidateId: candidate.candidateId }).onConflictDoUpdate({ target: [groupVotes.groupId, groupVotes.userId], set: { candidateId: candidate.candidateId, createdAt: new Date().toISOString() } });
  return Response.json({ group: await groupSnapshot(id, identity.id) });
}
