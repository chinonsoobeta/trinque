import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { AuthenticationError, requireAuthenticatedIdentity } from "@/lib/auth";
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES, avatarKey, avatarKeyFromUrl, avatarUrlForKey, getImageBucket } from "@/lib/r2-avatar";

export const runtime = "edge";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("avatars/")) return new Response("Not found", { status: 404 });
  try {
    const object = await (await getImageBucket()).get(key);
    if (!object?.body) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": object.httpMetadata?.cacheControl ?? "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Image storage unavailable", { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Image file required." }, { status: 400 });
    if (!AVATAR_CONTENT_TYPES.has(file.type)) return Response.json({ error: "Use JPEG, PNG, WebP, or AVIF." }, { status: 415 });
    if (file.size < 1 || file.size > AVATAR_MAX_BYTES) return Response.json({ error: "Avatar must be 5 MB or smaller." }, { status: 413 });

    const db = await getDb();
    const [current] = await db.select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
    if (!current) return Response.json({ error: "Profile not found." }, { status: 404 });

    const bucket = await getImageBucket();
    const key = avatarKey(identity.id, file.type);
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    const avatarUrl = avatarUrlForKey(key);
    const now = new Date().toISOString();
    await db.update(profiles).set({ avatarUrl, updatedAt: now }).where(eq(profiles.userId, identity.id));
    await db.update(users).set({ avatarUrl, updatedAt: now }).where(eq(users.id, identity.id));

    const previousKey = avatarKeyFromUrl(current.avatarUrl);
    if (previousKey && previousKey !== key) await bucket.delete(previousKey).catch(() => undefined);
    return Response.json({ ok: true, avatarUrl });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unable to upload avatar." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const db = await getDb();
    const [current] = await db.select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
    const key = avatarKeyFromUrl(current?.avatarUrl);
    const now = new Date().toISOString();
    await db.update(profiles).set({ avatarUrl: null, updatedAt: now }).where(eq(profiles.userId, identity.id));
    await db.update(users).set({ avatarUrl: null, updatedAt: now }).where(eq(users.id, identity.id));
    if (key) await (await getImageBucket()).delete(key).catch(() => undefined);
    return Response.json({ ok: true, avatarUrl: null });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unable to remove avatar." }, { status: 503 });
  }
}
