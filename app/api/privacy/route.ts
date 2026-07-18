import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { preferences, publishedDishes, userConsents, users } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { deleteDishImage } from "@/lib/uploads";

export const runtime = "edge";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const db = await getDb();
  const [consent] = await db.select().from(userConsents).where(eq(userConsents.userId, identity.id)).limit(1);
  return Response.json({ consent: consent ?? { userId: identity.id, locationConsent: false, analyticsConsent: false, imageRetentionConsent: false, consentedAt: null, withdrawnAt: null } });
}

export async function PUT(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const body = await request.json() as { locationConsent?: boolean; analyticsConsent?: boolean; imageRetentionConsent?: boolean };
  if ([body.locationConsent, body.analyticsConsent, body.imageRetentionConsent].some((value) => value !== undefined && typeof value !== "boolean")) return Response.json({ error: "invalid_consent" }, { status: 400 });
  const db = await getDb();
  const [current] = await db.select().from(userConsents).where(eq(userConsents.userId, identity.id)).limit(1);
  const now = new Date().toISOString();
  const values = { userId: identity.id, locationConsent: body.locationConsent ?? current?.locationConsent ?? false, analyticsConsent: body.analyticsConsent ?? current?.analyticsConsent ?? false, imageRetentionConsent: body.imageRetentionConsent ?? current?.imageRetentionConsent ?? false, consentedAt: Object.values(body).some(Boolean) ? now : current?.consentedAt, withdrawnAt: Object.values(body).some((value) => value === false) ? now : current?.withdrawnAt, updatedAt: now };
  if (body.locationConsent === false) await db.update(preferences).set({ locationLatitude: null, locationLongitude: null, locationLocality: null, locationAdministrativeRegion: null, locationCountryCode: null, locationTimeZone: null, locationCurrencyCode: null, locationLocale: null, locationUpdatedAt: null, updatedAt: now }).where(eq(preferences.userId, identity.id));
  if (body.imageRetentionConsent === false) {
    const images = await db.select({ imageKey: publishedDishes.imageKey }).from(publishedDishes).where(eq(publishedDishes.ownerId, identity.id));
    for (const { imageKey } of images) if (imageKey && !await deleteDishImage(imageKey)) return Response.json({ error: "uploads_unavailable" }, { status: 503 });
    await db.update(publishedDishes).set({ imageKey: null }).where(eq(publishedDishes.ownerId, identity.id));
  }
  await db.insert(userConsents).values(values).onConflictDoUpdate({ target: userConsents.userId, set: values });
  const [saved] = await db.select().from(userConsents).where(eq(userConsents.userId, identity.id)).limit(1);
  return Response.json({ consent: saved });
}

export async function DELETE(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401 });
  const db = await getDb();
  const images = await db.select({ imageKey: publishedDishes.imageKey }).from(publishedDishes).where(eq(publishedDishes.ownerId, identity.id));
  for (const { imageKey } of images) if (imageKey && !await deleteDishImage(imageKey)) return Response.json({ error: "uploads_unavailable" }, { status: 503 });
  await db.delete(users).where(eq(users.id, identity.id));
  return new Response(null, { status: 204 });
}
