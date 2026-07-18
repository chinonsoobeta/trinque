import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { preferences } from "@/db/schema";
import { requireIdentity } from "@/lib/identity";
import { coarseLocation, normalizeLocation, type LocationCandidate } from "@/lib/location";
import { SUPPORTED_LANGUAGES, type SupportedLanguage, type ThemePreference } from "@/lib/regions";

export const runtime = "edge";
const headers = { "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS" };

export function OPTIONS() { return new Response(null, { status: 204, headers }); }

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401, headers });
  const db = await getDb();
  const [row] = await db.select().from(preferences).where(eq(preferences.userId, identity.id)).limit(1);
  return Response.json({ preferences: row ? serialize(row) : null }, { headers });
}

export async function PUT(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "guest_session_required" }, { status: 401, headers });
  const body = await request.json() as { language?: SupportedLanguage; theme?: ThemePreference; measurementSystem?: "metric" | "imperial"; location?: LocationCandidate | null };
  if (body.language && !SUPPORTED_LANGUAGES.includes(body.language)) return Response.json({ error: "unsupported_language" }, { status: 400, headers });
  if (body.theme && !["system", "light", "dark"].includes(body.theme)) return Response.json({ error: "unsupported_theme" }, { status: 400, headers });
  if (body.measurementSystem && !["metric", "imperial"].includes(body.measurementSystem)) return Response.json({ error: "unsupported_measurement" }, { status: 400, headers });

  const db = await getDb();
  const [current] = await db.select().from(preferences).where(eq(preferences.userId, identity.id)).limit(1);
  const language = body.language ?? (current?.language as SupportedLanguage | undefined) ?? "en-CA";
  let locationValues: Record<string, unknown> = {};
  try {
    if (body.location) {
      const location = coarseLocation(normalizeLocation(body.location, language));
      locationValues = {
        locationLatitude: location.latitude,
        locationLongitude: location.longitude,
        locationLocality: location.locality,
        locationAdministrativeRegion: location.administrativeRegion,
        locationCountryCode: location.countryCode,
        locationTimeZone: location.timeZone,
        locationCurrencyCode: location.currencyCode,
        locationLocale: location.locale,
        locationUpdatedAt: new Date().toISOString(),
        measurementSystem: body.measurementSystem ?? location.measurementSystem,
      };
    } else if (body.location === null) {
      locationValues = {
        locationLatitude: null,
        locationLongitude: null,
        locationLocality: null,
        locationAdministrativeRegion: null,
        locationCountryCode: null,
        locationTimeZone: null,
        locationCurrencyCode: null,
        locationLocale: null,
        locationUpdatedAt: null,
      };
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "invalid_location" }, { status: 400, headers });
  }

  const values = {
    userId: identity.id,
    language,
    theme: body.theme ?? current?.theme ?? "system",
    measurementSystem: body.measurementSystem ?? current?.measurementSystem ?? "metric",
    ...locationValues,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(preferences).values(values).onConflictDoUpdate({ target: preferences.userId, set: values });
  const [saved] = await db.select().from(preferences).where(eq(preferences.userId, identity.id)).limit(1);
  return Response.json({ preferences: serialize(saved) }, { headers });
}

function serialize(row: typeof preferences.$inferSelect) {
  const location = row.locationLatitude != null && row.locationLongitude != null && row.locationCountryCode
    ? {
        latitude: row.locationLatitude,
        longitude: row.locationLongitude,
        locality: row.locationLocality,
        administrativeRegion: row.locationAdministrativeRegion,
        countryCode: row.locationCountryCode,
        timeZone: row.locationTimeZone,
        currencyCode: row.locationCurrencyCode,
        locale: row.locationLocale,
        language: row.language,
        measurementSystem: row.measurementSystem,
        source: "manual",
      }
    : null;
  return { language: row.language, theme: row.theme, measurementSystem: row.measurementSystem, location };
}
