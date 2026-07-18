import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analyticsEvents, feedbackReports, groupMembers, groupRsvps, groupVotes, groups, preferences, publishedDishes, saves, userConsents, users } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const db = await getDb();
  const [account, preference, consent, saved, dishes, memberships, votes, rsvps, ownedGroups, analytics, feedback] = await Promise.all([
    db.select({ id: users.id, authType: users.authType, displayName: users.displayName, email: users.email, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users).where(eq(users.id, identity.id)).limit(1),
    db.select().from(preferences).where(eq(preferences.userId, identity.id)).limit(1),
    db.select().from(userConsents).where(eq(userConsents.userId, identity.id)).limit(1),
    db.select().from(saves).where(eq(saves.userId, identity.id)),
    db.select().from(publishedDishes).where(eq(publishedDishes.ownerId, identity.id)),
    db.select().from(groupMembers).where(eq(groupMembers.userId, identity.id)),
    db.select().from(groupVotes).where(eq(groupVotes.userId, identity.id)),
    db.select().from(groupRsvps).where(eq(groupRsvps.userId, identity.id)),
    db.select().from(groups).where(eq(groups.ownerId, identity.id)),
    db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, identity.id)),
    db.select().from(feedbackReports).where(eq(feedbackReports.userId, identity.id)),
  ]);
  return Response.json({ exportedAt: new Date().toISOString(), account: account[0] ?? null, preferences: preference[0] ?? null, consent: consent[0] ?? null, saves: saved, publishedDishes: dishes.map(({ imageKey: _imageKey, ...dish }) => ({ ...dish, storedImage: Boolean(_imageKey) })), groupMemberships: memberships, groupVotes: votes, groupRsvps: rsvps, ownedGroups, analyticsEvents: analytics, feedbackReports: feedback }, { headers: { "Content-Disposition": "attachment; filename=trinque-data-export.json", "Cache-Control": "private, no-store" } });
}
