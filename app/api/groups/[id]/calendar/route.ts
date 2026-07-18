import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { calendarDocument } from "@/lib/group-planning";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return new Response("Guest session required.", { status: 401 });
  const { id } = await params;
  const group = await groupSnapshot(id);
  if (!group || group.ownerId !== identity.id || group.status !== "finalized" || !group.selectedCandidateId) return new Response("Finalized group plan not found.", { status: 404 });
  const db = await getDb();
  const candidates = await db.select().from(groupCandidates).where(eq(groupCandidates.groupId, id));
  const winner = candidates.find((candidate) => candidate.candidateId === group.selectedCandidateId);
  if (!winner) return new Response("Winner not found.", { status: 404 });
  const document = calendarDocument({ name: group.name, eventTime: group.eventTime, restaurant: winner.restaurant, neighborhood: winner.neighborhood, description: `${winner.name}. ${winner.explanation}` });
  return new Response(document, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="trinque-${id.slice(0, 8)}.ics"` } });
}
