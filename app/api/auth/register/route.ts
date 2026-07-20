import { AuthenticationError, registerSupabaseAccount } from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const identity = await registerSupabaseAccount(request);
    return Response.json({ ok: true, identity }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? error.status : 503;
    const message = error instanceof AuthenticationError ? error.message : "Unable to initialize account.";
    return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
