import { eq } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { analyticsEvents, userConsents } from "../db/schema.ts";
import { SUPPORTED_COUNTRY_CODES, SUPPORTED_LANGUAGES, type SupportedCountry, type SupportedLanguage } from "./regions.ts";

export const ANALYTICS_EVENTS = ["analysis_started", "analysis_completed", "analysis_failed", "analysis_corrected", "dish_published", "match_opened", "group_created", "invite_joined", "vote_cast", "plan_finalized", "rsvp_submitted"] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

export type AnalyticsInput = {
  event: AnalyticsEvent;
  language?: SupportedLanguage;
  countryCode?: SupportedCountry;
  mode?: "live" | "demo";
  outcome?: string;
  durationMs?: number;
};

export function parseAnalyticsInput(value: unknown): AnalyticsInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!ANALYTICS_EVENTS.includes(input.event as AnalyticsEvent)) return null;
  if (input.language !== undefined && !SUPPORTED_LANGUAGES.includes(input.language as SupportedLanguage)) return null;
  if (input.countryCode !== undefined && !SUPPORTED_COUNTRY_CODES.includes(input.countryCode as SupportedCountry)) return null;
  if (input.mode !== undefined && input.mode !== "live" && input.mode !== "demo") return null;
  if (input.outcome !== undefined && (typeof input.outcome !== "string" || input.outcome.length > 64 || !/^[A-Za-z0-9_-]+$/.test(input.outcome))) return null;
  if (input.durationMs !== undefined && (!Number.isInteger(input.durationMs) || Number(input.durationMs) < 0 || Number(input.durationMs) > 3_600_000)) return null;
  return input as AnalyticsInput;
}

export async function recordConsentedAnalytics(userId: string, input: AnalyticsInput): Promise<boolean> {
  const db = await getDb();
  const [consent] = await db.select({ analyticsConsent: userConsents.analyticsConsent }).from(userConsents).where(eq(userConsents.userId, userId)).limit(1);
  if (!consent?.analyticsConsent) return false;
  await db.insert(analyticsEvents).values({ id: crypto.randomUUID(), userId, ...input });
  return true;
}
