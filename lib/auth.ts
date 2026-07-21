import { and, eq, gt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, sessions, users } from "@/db/schema";
import { guestTokenFromRequest } from "@/lib/guest-token";
import { supabaseUserFromRequest, type SupabaseUser } from "@/lib/supabase-auth";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "trinque_session";

export type TrinqueIdentity = {
  id: string;
  authType: "guest" | "chatgpt" | "supabase";
  displayName: string;
  email: string | null;
};

export type AuthenticatedIdentity = TrinqueIdentity & {
  authType: "chatgpt" | "supabase";
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.", readonly status = 401) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function getOptionalIdentity(request: Request): Promise<TrinqueIdentity | null> {
  const chatgpt = await chatGPTIdentityFromRequest(request);
  if (chatgpt) return chatgpt;

  const appSession = await appSessionIdentityFromRequest(request);
  if (appSession) return appSession;

  const supabaseUser = await supabaseUserFromRequest(request);
  if (supabaseUser) return syncSupabaseIdentity(supabaseUser);

  const guestToken = guestTokenFromRequest(request);
  return guestToken ? findGuestByToken(guestToken) : null;
}

export async function requireAuthenticatedIdentity(request: Request): Promise<AuthenticatedIdentity> {
  const identity = await getOptionalIdentity(request);
  if (!identity || identity.authType === "guest") throw new AuthenticationError();
  if (usesCookieSession(request) && isUnsafeMethod(request.method) && !isSameOriginRequest(request)) {
    throw new AuthenticationError("Cross-site mutation rejected.", 403);
  }
  return identity as AuthenticatedIdentity;
}

/** Browsing is public. Creating social content requires a completed profile. */
export async function requireOnboardedIdentity(request: Request): Promise<AuthenticatedIdentity> {
  const identity = await requireAuthenticatedIdentity(request);
  const db = await getDb();
  const [profile] = await db.select({ onboardingCompletedAt: profiles.onboardingCompletedAt })
    .from(profiles).where(eq(profiles.userId, identity.id)).limit(1);
  if (!profile?.onboardingCompletedAt) throw new AuthenticationError("Complete your profile first.", 403);
  return identity;
}

export async function issueAppSession(userId: string, request?: Request) {
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const db = await getDb();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(token),
    expiresAt,
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    userAgent: request?.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  return { token, expiresAt };
}

export async function revokeAppSession(request: Request): Promise<void> {
  const token = sessionTokenFromRequest(request);
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(token)));
}

export async function createSessionFromSupabase(request: Request) {
  const supabaseUser = await supabaseUserFromRequest(request);
  if (!supabaseUser) throw new AuthenticationError("Valid Supabase session required.");
  const identity = await syncSupabaseIdentity(supabaseUser);
  const session = await issueAppSession(identity.id, request);
  return { identity, ...session };
}

export async function registerSupabaseAccount(request: Request) {
  const supabaseUser = await supabaseUserFromRequest(request);
  if (!supabaseUser) throw new AuthenticationError("Valid Supabase session required.");
  return syncSupabaseIdentity(supabaseUser);
}

/**
 * Transitional endpoint behavior for existing web/iOS clients.
 * Anonymous callers still receive a guest token only when they explicitly POST
 * to the legacy session endpoint. Public read routes should use getOptionalIdentity()
 * and never call this helper just because somebody browsed anonymously.
 */
export async function getOrCreateLegacyIdentity(request: Request): Promise<{ identity: TrinqueIdentity; guestToken?: string; sessionToken?: string; expiresAt?: string }> {
  const chatgpt = await chatGPTIdentityFromRequest(request);
  if (chatgpt) return { identity: chatgpt };

  const appSession = await appSessionIdentityFromRequest(request);
  if (appSession) return { identity: appSession };

  const supabaseUser = await supabaseUserFromRequest(request);
  if (supabaseUser) {
    const identity = await syncSupabaseIdentity(supabaseUser);
    const session = await issueAppSession(identity.id, request);
    // guestToken is a temporary response alias for old clients; the value is
    // stored only in sessions.token_hash, never users.guest_token_hash.
    return { identity, sessionToken: session.token, guestToken: session.token, expiresAt: session.expiresAt };
  }

  const suppliedGuestToken = guestTokenFromRequest(request);
  if (suppliedGuestToken) {
    const identity = await findGuestByToken(suppliedGuestToken);
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

export function sessionCookie(request: Request, token: string, expiresAt: string): string {
  const secure = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(request: Request): string {
  const secure = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function normalizeHandle(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "").replace(/-{2,}/g, "-");
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized) ? normalized : null;
}

async function appSessionIdentityFromRequest(request: Request): Promise<AuthenticatedIdentity | null> {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;
  const now = new Date().toISOString();
  const tokenHash = await hashToken(token);
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, authType: users.authType, displayName: users.displayName, email: users.email, deletedAt: users.deletedAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row || row.authType === "guest" || row.deletedAt) return null;
  await db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.sessionId));
  return { id: row.id, authType: row.authType as AuthenticatedIdentity["authType"], displayName: row.displayName, email: row.email };
}

async function findGuestByToken(token: string): Promise<TrinqueIdentity | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, authType: users.authType, displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.guestTokenHash, await hashToken(token)))
    .limit(1);
  return row && row.authType === "guest" ? { ...row, authType: "guest" } : null;
}

async function syncSupabaseIdentity(user: SupabaseUser): Promise<AuthenticatedIdentity> {
  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
  const authSubjectHash = await hashToken(`supabase:${user.id}`);
  const displayName = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || normalizedEmail || "Trinque member";
  const avatarUrl = user.user_metadata?.avatar_url?.trim() || null;
  const now = new Date().toISOString();
  const db = await getDb();
  const [existing] = await db.select({ id: users.id, deletedAt: users.deletedAt }).from(users).where(
    normalizedEmail ? or(eq(users.authSubjectHash, authSubjectHash), eq(users.normalizedEmail, normalizedEmail), eq(users.email, normalizedEmail)) : eq(users.authSubjectHash, authSubjectHash),
  ).limit(1);
  if (existing?.deletedAt) throw new AuthenticationError("This Trinque account has been deleted.", 403);
  const id = existing?.id ?? `supabase_${user.id}`;
  await db.insert(users).values({
    id,
    authType: "supabase",
    displayName,
    email: normalizedEmail,
    normalizedEmail,
    authSubjectHash,
    deletedAt: null,
    emailVerifiedAt: user.email_confirmed_at ?? null,
    avatarUrl,
    lastLoginAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      authType: "supabase",
      displayName,
      email: normalizedEmail,
      normalizedEmail,
      authSubjectHash,
      deletedAt: null,
      emailVerifiedAt: user.email_confirmed_at ?? null,
      avatarUrl,
      lastLoginAt: now,
      updatedAt: now,
    },
  });
  await ensureDefaultProfile(id, displayName, normalizedEmail, avatarUrl);
  return { id, authType: "supabase", displayName, email: normalizedEmail };
}

async function chatGPTIdentityFromRequest(request: Request): Promise<AuthenticatedIdentity | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return null;
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const displayName = encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safeDecode(encodedName) ?? email
    : email;
  const now = new Date().toISOString();
  const authSubjectHash = await hashToken(`chatgpt:${email}`);
  const db = await getDb();
  const [existing] = await db.select({ id: users.id, deletedAt: users.deletedAt }).from(users).where(or(eq(users.authSubjectHash, authSubjectHash), eq(users.normalizedEmail, email), eq(users.email, email))).limit(1);
  if (existing?.deletedAt) throw new AuthenticationError("This Trinque account has been deleted.", 403);
  const id = existing?.id ?? `chatgpt_${(await hashToken(email)).slice(0, 32)}`;
  await db.insert(users).values({ id, authType: "chatgpt", displayName, email, normalizedEmail: email, authSubjectHash, deletedAt: null, lastLoginAt: now })
    .onConflictDoUpdate({ target: users.id, set: { displayName, email, normalizedEmail: email, authSubjectHash, deletedAt: null, lastLoginAt: now, updatedAt: now } });
  await ensureDefaultProfile(id, displayName, email, null);
  return { id, authType: "chatgpt", displayName, email };
}

async function ensureDefaultProfile(userId: string, displayName: string, email: string | null, avatarUrl: string | null) {
  const db = await getDb();
  const [existing] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing) return;
  const rawBase = email?.split("@")[0] || displayName || "member";
  const normalizedBase = normalizeHandle(rawBase) ?? "member";
  let handle = normalizedBase;
  const [collision] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
  if (collision) handle = `${normalizedBase.slice(0, 22)}-${userId.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase()}`;
  await db.insert(profiles).values({ userId, displayName, handle, avatarUrl }).onConflictDoNothing();
}

export async function authSubjectHashForIdentity(identity: AuthenticatedIdentity, request: Request): Promise<string | null> {
  if (identity.authType === "chatgpt") {
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? identity.email?.trim().toLowerCase();
    return email ? hashToken(`chatgpt:${email}`) : null;
  }
  const supabaseUser = await supabaseUserFromRequest(request);
  if (supabaseUser?.id) return hashToken(`supabase:${supabaseUser.id}`);
  if (identity.id.startsWith("supabase_")) return hashToken(`supabase:${identity.id.slice("supabase_".length)}`);
  return null;
}

function sessionTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^(?:Session|Bearer|Guest)\s+([A-Za-z0-9._~-]+)$/i);
  if (match) return match[1];
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function usesCookieSession(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  return !/^(?:Session|Bearer|Guest)\s+/i.test(authorization) && (request.headers.get("cookie") ?? "").includes(`${SESSION_COOKIE}=`);
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    return new URL(origin).origin === `${forwardedProto}://${forwardedHost}`;
  } catch {
    return false;
  }
}

async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeDecode(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
