import { getRuntimeEnv } from "./runtime-env.ts";

export type SupabaseUser = { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: { full_name?: string; name?: string; avatar_url?: string } };

export async function supabaseConfig() {
  const env = await getRuntimeEnv();
  const url = (env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

export async function supabaseUserFromRequest(request: Request): Promise<SupabaseUser | null> {
  const match = (request.headers.get("authorization") ?? "").match(/^Bearer ([A-Za-z0-9._-]+)$/);
  if (!match) return null;
  const config = await supabaseConfig();
  if (!config) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, Authorization: `Bearer ${match[1]}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const user = await response.json() as SupabaseUser;
    return typeof user.id === "string" && user.id ? user : null;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}
