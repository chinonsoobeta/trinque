export type TrinqueRuntimeEnv = {
  OPENAI_API_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_UPLOADS_BUCKET?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  APPLE_DEVELOPER_TEAM_ID?: string;
  TRINQUE_ALLOWED_ORIGINS?: string;
  TRINQUE_BUDGET_ANALYSIS_USER_HOURLY?: string;
  TRINQUE_BUDGET_ANALYSIS_GLOBAL_HOURLY?: string;
  TRINQUE_BUDGET_PLACES_USER_HOURLY?: string;
  TRINQUE_BUDGET_PLACES_GLOBAL_HOURLY?: string;
  TRINQUE_BUDGET_PUBLISH_USER_HOURLY?: string;
  TRINQUE_BUDGET_PUBLISH_GLOBAL_HOURLY?: string;
  TRINQUE_BUDGET_INVITE_JOIN_USER_HOURLY?: string;
  TRINQUE_BUDGET_INVITE_JOIN_GLOBAL_HOURLY?: string;
  TRINQUE_BUDGET_VOTE_USER_HOURLY?: string;
  TRINQUE_BUDGET_VOTE_GLOBAL_HOURLY?: string;
};

export async function getRuntimeEnv(): Promise<TrinqueRuntimeEnv> {
  return process.env as TrinqueRuntimeEnv;
}

export function selectOpenAIKey(primary?: string, fallback?: string): string | undefined {
  const value = primary?.trim() || fallback?.trim();
  return value || undefined;
}

export function selectGooglePlacesKey(primary?: string, fallback?: string): string | undefined {
  const value = primary?.trim() || fallback?.trim();
  return value || undefined;
}
