import { supabaseConfig } from "@/lib/supabase-auth";


export async function GET() {
  const config = await supabaseConfig();
  return Response.json(
    { configured: Boolean(config), ...(config ?? {}), providers: { google: config ? await googleEnabled(config) : false } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The sign-in modal renders a Google button only when the Supabase project has
 * the provider turned on, so a disabled provider never shows a control whose
 * only possible outcome is an error. Any failure to confirm reports false: an
 * unreachable auth service could not complete the redirect either.
 */
async function googleEnabled(config: { url: string; publishableKey: string }): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return false;
    const settings = await response.json() as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
