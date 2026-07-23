import { eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  analyticsEvents,
  clientErrorReports,
  comments,
  feedbackReports,
  follows,
  groupMembers,
  groupRsvps,
  groupVotes,
  groups,
  likes,
  notifications,
  preferences,
  profiles,
  publishedDishes,
  restaurants,
  saves,
  sessions,
  userConsents,
  users,
} from "@/db/schema";
import { AuthenticationError, authSubjectHashForIdentity, clearedSessionCookie, requireAuthenticatedIdentity } from "@/lib/auth";
import { avatarKeyFromUrl, getImageBucket } from "@/lib/r2-avatar";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const db = await getDb();
    const [accountRows, profile, sessionRows, preferenceRows, consentRows, saveRows, followingRows, followerRows, likeRows, commentRows, notificationRows, dishRows, ownedGroupRows, memberRows, voteRows, rsvpRows, analyticsRows, feedbackRows, errorRows] = await Promise.all([
      db.select({ id: users.id, authType: users.authType, displayName: users.displayName, email: users.email, emailVerifiedAt: users.emailVerifiedAt, avatarUrl: users.avatarUrl, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users).where(eq(users.id, identity.id)),
      db.select().from(profiles).where(eq(profiles.userId, identity.id)),
      db.select({ id: sessions.id, expiresAt: sessions.expiresAt, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, userAgent: sessions.userAgent }).from(sessions).where(eq(sessions.userId, identity.id)),
      db.select().from(preferences).where(eq(preferences.userId, identity.id)),
      db.select().from(userConsents).where(eq(userConsents.userId, identity.id)),
      db.select().from(saves).where(eq(saves.userId, identity.id)),
      db.select().from(follows).where(eq(follows.followerId, identity.id)),
      db.select().from(follows).where(eq(follows.followingId, identity.id)),
      db.select().from(likes).where(eq(likes.userId, identity.id)),
      db.select().from(comments).where(eq(comments.userId, identity.id)),
      db.select({ id: notifications.id, actorId: notifications.actorId, type: notifications.type, targetId: notifications.targetId, read: notifications.read, createdAt: notifications.createdAt }).from(notifications).where(eq(notifications.userId, identity.id)),
      db.select().from(publishedDishes).where(eq(publishedDishes.ownerId, identity.id)),
      db.select().from(groups).where(eq(groups.ownerId, identity.id)),
      db.select().from(groupMembers).where(eq(groupMembers.userId, identity.id)),
      db.select().from(groupVotes).where(eq(groupVotes.userId, identity.id)),
      db.select().from(groupRsvps).where(eq(groupRsvps.userId, identity.id)),
      db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, identity.id)),
      db.select().from(feedbackReports).where(eq(feedbackReports.userId, identity.id)),
      db.select().from(clientErrorReports).where(eq(clientErrorReports.userId, identity.id)),
    ]);
    return Response.json({
      exportedAt: new Date().toISOString(),
      account: accountRows[0] ?? { id: identity.id, authType: identity.authType, displayName: identity.displayName, email: identity.email },
      sessions: sessionRows,
      profile: profile[0] ?? null,
      preferences: preferenceRows[0] ?? null,
      consents: consentRows[0] ?? null,
      saves: saveRows,
      social: { following: followingRows, followers: followerRows, likes: likeRows, comments: commentRows, notifications: notificationRows },
      contributions: { dishes: dishRows },
      groups: { owned: ownedGroupRows, memberships: memberRows, votes: voteRows, rsvps: rsvpRows },
      diagnostics: { analytics: analyticsRows, feedback: feedbackRows, clientErrors: errorRows },
    }, { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="trinque-account-export-${new Date().toISOString().slice(0, 10)}.json"` } });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "privacy_export_failed", code: "privacy_export_failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const db = await getDb();
    const [profile] = await db.select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
    const [account] = await db.select({ authSubjectHash: users.authSubjectHash }).from(users).where(eq(users.id, identity.id)).limit(1);
    const authSubjectHash = await authSubjectHashForIdentity(identity, request) ?? account?.authSubjectHash ?? null;
    const now = new Date().toISOString();

    // Delete user-authored/public social data rather than leaving personally attributable comments.
    await db.delete(notifications).where(or(eq(notifications.userId, identity.id), eq(notifications.actorId, identity.id)));
    await db.delete(comments).where(eq(comments.userId, identity.id));
    await db.delete(likes).where(eq(likes.userId, identity.id));
    await db.delete(follows).where(or(eq(follows.followerId, identity.id), eq(follows.followingId, identity.id)));
    await db.delete(saves).where(eq(saves.userId, identity.id));
    await db.delete(groupVotes).where(eq(groupVotes.userId, identity.id));
    await db.delete(groupRsvps).where(eq(groupRsvps.userId, identity.id));
    await db.delete(groupMembers).where(eq(groupMembers.userId, identity.id));
    await db.delete(groups).where(eq(groups.ownerId, identity.id));
    await db.delete(publishedDishes).where(eq(publishedDishes.ownerId, identity.id));
    await db.update(publishedDishes).set({ contributorId: null }).where(eq(publishedDishes.contributorId, identity.id));
    await db.update(restaurants).set({ createdById: null, updatedAt: now }).where(eq(restaurants.createdById, identity.id));
    await db.delete(preferences).where(eq(preferences.userId, identity.id));
    await db.delete(userConsents).where(eq(userConsents.userId, identity.id));
    await db.delete(analyticsEvents).where(eq(analyticsEvents.userId, identity.id));
    await db.delete(feedbackReports).where(eq(feedbackReports.userId, identity.id));
    await db.delete(clientErrorReports).where(eq(clientErrorReports.userId, identity.id));
    await db.delete(profiles).where(eq(profiles.userId, identity.id));
    await db.delete(sessions).where(eq(sessions.userId, identity.id));
    await db.update(users).set({
      displayName: "Deleted account",
      email: null,
      normalizedEmail: null,
      authSubjectHash,
      deletedAt: now,
      emailVerifiedAt: null,
      avatarUrl: null,
      lastLoginAt: null,
      guestTokenHash: null,
      updatedAt: now,
    }).where(eq(users.id, identity.id));

    const key = avatarKeyFromUrl(profile?.avatarUrl);
    if (key) {
      try { await (await getImageBucket()).delete(key); } catch { /* Account deletion must not be blocked by image storage availability. */ }
    }
    return Response.json({ ok: true, deletedAt: now }, { headers: { "Set-Cookie": clearedSessionCookie(request), "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "privacy_delete_failed", code: "privacy_delete_failed" }, { status: 500 });
  }
}
