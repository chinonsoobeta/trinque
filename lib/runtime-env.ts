export type TrinqueRuntimeEnv = {
  OPENAI_API_KEY?: string;
  GCP_API_KEY?: string;
  TRINQUE_ADMIN_IDENTITY_HASHES?: string;
  GOOGLE_PLACES_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  DB?: unknown;
  UPLOADS?: unknown;
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
  try {
    const { env } = await import("cloudflare:workers");
    return env as TrinqueRuntimeEnv;
  } catch {
    return {};
  }
}

export function selectOpenAIKey(workerKey?: string, nodeKey?: string): string | undefined {
  const value = workerKey?.trim() || nodeKey?.trim();
  return value || undefined;
}

export function selectGooglePlacesKey(
  workerKey?: string,
  workerLegacyKey?: string,
  nodeKey?: string,
  nodeLegacyKey?: string,
): string | undefined {
  const value = workerKey?.trim()
    || workerLegacyKey?.trim()
    || nodeKey?.trim()
    || nodeLegacyKey?.trim();
  return value || undefined;
}
