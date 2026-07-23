import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { selectGroupWinner, type RankedGroupCandidate } from "@/lib/group-planning";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let identity;
  try { identity = await requireOnboardedIdentity(request); }
  catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "authentication_required" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
  const { id } = await params;
  const db = await getDb();
  const [owned] = await db.select().from(groups).where(and(eq(groups.id, id), eq(groups.ownerId, identity.id))).limit(1);
  if (!owned) return Response.json({ error: "group_plan_not_found", code: "group_plan_not_found" }, { status: 404 });
  const snapshot = await groupSnapshot(id, identity.id);
  if (!snapshot) return Response.json({ error: "group_plan_not_found", code: "group_plan_not_found" }, { status: 404 });
  const candidates = snapshot.candidates as RankedGroupCandidate[];
  const winner = selectGroupWinner(candidates, snapshot.votes);
  if (!winner) return Response.json({ error: "no_eligible_candidate", code: "no_eligible_candidate" }, { status: 409 });
  await db.update(groups).set({ status: "finalized", selectedCandidateId: winner.candidateId, updatedAt: new Date().toISOString() }).where(eq(groups.id, id));
  return Response.json({ group: await groupSnapshot(id, identity.id), winner });
}
