"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type Config = { configured: boolean; url?: string; publishableKey?: string };

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const config = await response.json() as Config;
        return config.configured && config.url && config.publishableKey
          ? createClient(config.url, config.publishableKey)
          : null;
      })
      .catch(() => null);
  }
  return clientPromise;
}

export async function signUpWithPassword(email: string, password: string) {
  const client = await requireClient();
  return client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: callbackUrl("/") },
  });
}

export async function signInWithPassword(email: string, password: string) {
  const client = await requireClient();
  return client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
}

export async function signInWithGoogle(next = "/") {
  const client = await requireClient();
  return client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
}

export async function signOutSupabase() {
  const client = await getSupabaseClient();
  return client?.auth.signOut() ?? { error: null };
}

export async function requestPasswordReset(email: string) {
  const client = await requireClient();
  return client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: callbackUrl("/auth/login?recovery=1") });
}

export async function updatePassword(password: string) {
  const client = await requireClient();
  return client.auth.updateUser({ password });
}

export async function currentSupabaseSession(): Promise<Session | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", safeReturnPath(next));
  return url.toString();
}

async function requireClient(): Promise<SupabaseClient> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Authentication is not configured.");
  return client;
}
