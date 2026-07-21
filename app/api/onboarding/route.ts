import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { preferences, profiles, users } from "@/db/schema";
import { normalizeHandle, requireAuthenticatedIdentity, AuthenticationError } from "@/lib/auth";
import { isSupportedCountry, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const db = await getDb();
    const [profile] = await db.select({ onboardingCompletedAt: profiles.onboardingCompletedAt }).from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
    return Response.json({ complete: Boolean(profile?.onboardingCompletedAt) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "onboarding_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}

export async function PUT(request: Request) {
  try {
    const identity = await requireAuthenticatedIdentity(request);
    const body = await request.json() as { name?: string; countryCode?: string; language?: SupportedLanguage; handle?: string; favoriteCuisines?: string[] };
    const name = body.name?.trim() ?? "";
    const handle = normalizeHandle(body.handle ?? "");
    if (!name || name.length > 80) return Response.json({ error: "valid_name_required" }, { status: 400 });
    if (!isSupportedCountry(body.countryCode)) return Response.json({ error: "supported_country_required" }, { status: 400 });
    if (!body.language || !SUPPORTED_LANGUAGES.includes(body.language)) return Response.json({ error: "supported_language_required" }, { status: 400 });
    if (!handle) return Response.json({ error: "valid_username_required" }, { status: 400 });
    const favoriteCuisines = (body.favoriteCuisines ?? []).filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 20);
    const db = await getDb();
    const [taken] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
    if (taken && taken.userId !== identity.id) return Response.json({ error: "username_taken" }, { status: 409 });
    const now = new Date().toISOString();
    await db.update(profiles).set({ displayName: name, handle, countryCode: body.countryCode, favoriteCuisines: JSON.stringify(favoriteCuisines), onboardingCompletedAt: now, updatedAt: now }).where(eq(profiles.userId, identity.id));
    await db.update(users).set({ displayName: name, updatedAt: now }).where(eq(users.id, identity.id));
    await db.insert(preferences).values({ userId: identity.id, language: body.language, updatedAt: now }).onConflictDoUpdate({ target: preferences.userId, set: { language: body.language, updatedAt: now } });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "onboarding_unavailable" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
}
