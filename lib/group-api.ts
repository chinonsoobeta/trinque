import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupMembers, groupRsvps, groupVotes, groups } from "@/db/schema";

export async function groupMembership(groupId: string, userId: string) {
  const db = await getDb();
  const [membership] = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))).limit(1);
  return membership ?? null;
}

export async function groupSnapshot(groupId: string, viewerId: string) {
  const membership = await groupMembership(groupId, viewerId);
  if (!membership) return null;
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;
  const candidates = await db.select().from(groupCandidates).where(eq(groupCandidates.groupId, groupId)).orderBy(desc(groupCandidates.eligible), desc(groupCandidates.score), asc(groupCandidates.distanceKm));
  const votes = await db.select({ candidateId: groupVotes.candidateId, count: sql<number>`count(*)` }).from(groupVotes).where(eq(groupVotes.groupId, groupId)).groupBy(groupVotes.candidateId);
  const rsvps = await db.select({ status: groupRsvps.status, count: sql<number>`count(*)` }).from(groupRsvps).where(eq(groupRsvps.groupId, groupId)).groupBy(groupRsvps.status);
  const [{ count: memberCount }] = await db.select({ count: sql<number>`count(*)` }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const [viewerVote] = await db.select({ candidateId: groupVotes.candidateId }).from(groupVotes).where(and(eq(groupVotes.groupId, groupId), eq(groupVotes.userId, viewerId))).limit(1);
  const [viewerRsvp] = await db.select({ status: groupRsvps.status }).from(groupRsvps).where(and(eq(groupRsvps.groupId, groupId), eq(groupRsvps.userId, viewerId))).limit(1);
  return { ...group, allergies: JSON.parse(group.allergies) as string[], candidates: candidates.map((candidate) => ({ ...candidate, conflicts: JSON.parse(candidate.conflicts) as string[] })), votes: Object.fromEntries(votes.map((vote) => [vote.candidateId, Number(vote.count)])), rsvps: Object.fromEntries(rsvps.map((rsvp) => [rsvp.status, Number(rsvp.count)])), memberCount: Number(memberCount), viewerRole: membership.role, viewerVote: viewerVote?.candidateId ?? null, viewerRsvp: viewerRsvp?.status ?? null };
}
