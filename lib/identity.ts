import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { guestTokenFromRequest } from "@/lib/guest-token";
import { supabaseUserFromRequest } from "@/lib/supabase-auth";

export type TrinqueIdentity = {
  id: string;
  authType: "guest" | "chatgpt" | "supabase";
  displayName: string;
  email: string | null;
};

export async function getOrCreateIdentity(request: Request): Promise<{ identity: TrinqueIdentity; guestToken?: string }> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (email) return { identity: await upsertChatGPTIdentity(request, email) };

  const supabaseUser = await supabaseUserFromRequest(request);
  if (supabaseUser) return issueSupabaseSession(supabaseUser);

  const suppliedToken = guestTokenFromRequest(request);
  if (suppliedToken) {
    const identity = await findGuestByToken(suppliedToken);
    if (identity) return { identity };
  }

  const guestToken = randomToken();
  const identity: TrinqueIdentity = {
    id: crypto.randomUUID(),
    authType: "guest",
    displayName: "Guest explorer",
    email: null,
  };
  const db = await getDb();
  await db.insert(users).values({ ...identity, guestTokenHash: await hashToken(guestToken) });
  return { identity, guestToken };
}

export async function requireIdentity(request: Request): Promise<TrinqueIdentity | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (email) return upsertChatGPTIdentity(request, email);
  const supabaseUser = await supabaseUserFromRequest(request);
  if (supabaseUser) return upsertSupabaseIdentity(supabaseUser);
  const token = guestTokenFromRequest(request);
  return token ? findGuestByToken(token) : null;
}

async function findGuestByToken(token: string): Promise<TrinqueIdentity | null> {
  const db = await getDb();
  const [row] = await db.select({ id: users.id, authType: users.authType, displayName: users.displayName, email: users.email }).from(users).where(eq(users.guestTokenHash, await hashToken(token))).limit(1);
  return row ? { ...row, authType: row.authType as TrinqueIdentity["authType"] } : null;
}

async function issueSupabaseSession(user: NonNullable<Awaited<ReturnType<typeof supabaseUserFromRequest>>>) {
  const identity = await upsertSupabaseIdentity(user);
  const guestToken = randomToken();
  const db = await getDb();
  await db.update(users).set({ guestTokenHash: await hashToken(guestToken), updatedAt: new Date().toISOString() }).where(eq(users.id, identity.id));
  return { identity, guestToken };
}

async function upsertSupabaseIdentity(user: NonNullable<Awaited<ReturnType<typeof supabaseUserFromRequest>>>): Promise<TrinqueIdentity> {
  const email = user.email?.trim().toLowerCase() ?? null;
  const displayName = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || email || "Trinque member";
  const identity: TrinqueIdentity = { id: `supabase_${user.id}`, authType: "supabase", displayName, email };
  const db = await getDb();
  await db.insert(users).values(identity).onConflictDoUpdate({ target: users.id, set: { displayName, email, authType: "supabase", updatedAt: new Date().toISOString() } });
  return identity;
}

async function upsertChatGPTIdentity(request: Request, email: string): Promise<TrinqueIdentity> {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const displayName = encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safeDecode(encodedName) ?? email
    : email;
  const id = `chatgpt_${(await hashToken(email)).slice(0, 32)}`;
  const db = await getDb();
  await db.insert(users).values({ id, authType: "chatgpt", displayName, email }).onConflictDoUpdate({ target: users.id, set: { displayName, email, updatedAt: new Date().toISOString() } });
  return { id, authType: "chatgpt", displayName, email };
}

async function hashToken(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

function safeDecode(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
