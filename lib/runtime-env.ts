export type TrinqueRuntimeEnv = {
  OPENAI_API_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
  DB?: unknown;
  UPLOADS?: unknown;
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

export function selectGooglePlacesKey(workerKey?: string, nodeKey?: string): string | undefined {
  const value = workerKey?.trim() || nodeKey?.trim();
  return value || undefined;
}
