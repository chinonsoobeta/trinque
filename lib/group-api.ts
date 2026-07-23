import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groupMembers, groupRsvps, groupVotes, groups } from "@/db/schema";
import { DIETARY_LABELS, type Tier } from "@/lib/group-planning";

export async function groupMembership(groupId: string, userId: string) {
  const db = await getDb();
  const [membership] = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))).limit(1);
  return membership ?? null;
}

function resolveReasons(conflicts: string[]): { tier: Tier; explanation: string; reasons: string[] } {
  if (!conflicts.length) return { tier: "fits", explanation: "Fits the plan", reasons: [] };
  const hard = conflicts.filter((code) => code.split(":", 1)[0] !== "price_unknown");
  if (hard.length) return { tier: "does_not_fit", explanation: "Does not fit the plan", reasons: hard };
  return { tier: "needs_checking", explanation: "Needs checking", reasons: conflicts };
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
  return { ...group, allergies: JSON.parse(group.allergies) as string[], dietaryRequirements: JSON.parse(group.dietaryRequirements) as string[], cuisineTypes: JSON.parse(group.cuisineTypes) as string[], candidates: candidates.map((candidate) => { const parsed = JSON.parse(candidate.conflicts) as string[]; const { tier, explanation, reasons } = resolveReasons(parsed); return { ...candidate, conflicts: parsed, tier, explanation, reasons }; }), votes: Object.fromEntries(votes.map((vote) => [vote.candidateId, Number(vote.count)])), rsvps: Object.fromEntries(rsvps.map((rsvp) => [rsvp.status, Number(rsvp.count)])), memberCount: Number(memberCount), viewerRole: membership.role, viewerVote: viewerVote?.candidateId ?? null, viewerRsvp: viewerRsvp?.status ?? null };
}

function humanReason(code: string): string {
  const colonIndex = code.indexOf(":");
  const key = colonIndex >= 0 ? code.slice(0, colonIndex) : code;
  const detail = colonIndex >= 0 ? code.slice(colonIndex + 1) : undefined;
  const translations: Record<string, string> = { over_budget: "Over budget", beyond_distance: "Too far", price_unknown: "Price not known", vegetarian_unknown: "Cannot confirm vegetarian", vegetarian_unsupported: "Does not support vegetarian", cuisine_unknown_or_mismatch: "Cuisine type does not match" };
  const base = translations[key];
  if (!base) return "Does not fit the plan";
  if (key === "allergen_unknown") return `Cannot confirm ${detail ?? "allergen"}`;
  if (key === "allergen_conflict") return `Contains ${detail ?? "allergen"}`;
  const suffix = detail && DIETARY_LABELS[detail as keyof typeof DIETARY_LABELS] ? `: ${DIETARY_LABELS[detail as keyof typeof DIETARY_LABELS]}` : "";
  return `${base}${suffix}`;
}
