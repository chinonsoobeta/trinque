"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { usePreferences } from "@/components/PreferencesProvider";

export type AnalyticsEvent =
  | "analysis_started" | "analysis_completed" | "analysis_failed" | "analysis_corrected"
  | "dish_published" | "match_opened"
  | "group_created" | "invite_joined" | "vote_cast" | "plan_finalized" | "rsvp_submitted";

type AnalyticsDetails = { mode?: "live" | "demo"; outcome?: string; durationMs?: number };

/**
 * Product events, sent with the viewer's language and country only — never a
 * precise location and never dish content.
 */
export function useAnalytics() {
  const { sessionToken } = useAuth();
  const { language, location } = usePreferences();
  return useCallback((event: AnalyticsEvent, details: AnalyticsDetails = {}) => {
    if (!sessionToken) return;
    void fetch("/api/analytics", {
      method: "POST",
      headers: { Authorization: `Session ${sessionToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event, language, countryCode: location?.countryCode, ...details }),
    }).catch(() => undefined);
  }, [language, location?.countryCode, sessionToken]);
}
