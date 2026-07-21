import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupVotes, groups } from "@/db/schema";
import { groupMembership, groupSnapshot } from "@/lib/group-api";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";
import { budgetResponse, enforceUsageBudget, requestIdFor, UsageBudgetError } from "@/lib/operations";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  let identity;
  try { identity = await requireOnboardedIdentity(request); }
  catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "authentication_required" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
  try { await enforceUsageBudget("vote", identity.id); }
  catch (error) { if (error instanceof UsageBudgetError) return budgetResponse(error, requestId); throw error; }
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
