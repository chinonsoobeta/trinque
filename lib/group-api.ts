import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupRsvps, groupVotes, groups } from "@/db/schema";

export async function groupSnapshot(groupId: string) {
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;
  const candidates = await db.select().from(groupCandidates).where(eq(groupCandidates.groupId, groupId)).orderBy(desc(groupCandidates.eligible), desc(groupCandidates.score), asc(groupCandidates.distanceKm));
  const votes = await db.select({ candidateId: groupVotes.candidateId, count: sql<number>`count(*)` }).from(groupVotes).where(eq(groupVotes.groupId, groupId)).groupBy(groupVotes.candidateId);
  const rsvps = await db.select({ status: groupRsvps.status, count: sql<number>`count(*)` }).from(groupRsvps).where(eq(groupRsvps.groupId, groupId)).groupBy(groupRsvps.status);
  return {
    ...group,
    allergies: JSON.parse(group.allergies) as string[],
    candidates: candidates.map((candidate) => ({ ...candidate, conflicts: JSON.parse(candidate.conflicts) as string[] })),
    votes: Object.fromEntries(votes.map((vote) => [vote.candidateId, Number(vote.count)])),
    rsvps: Object.fromEntries(rsvps.map((rsvp) => [rsvp.status, Number(rsvp.count)])),
  };
}
