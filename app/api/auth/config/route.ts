import { supabaseConfig } from "@/lib/supabase-auth";

export const runtime = "edge";

export async function GET() {
  const config = await supabaseConfig();
  return Response.json({ configured: Boolean(config), ...(config ?? {}) }, { headers: { "Cache-Control": "no-store" } });
}
