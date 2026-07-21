import { getRuntimeEnv } from "./runtime-env.ts";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The secret stores comma-separated SHA-256 hashes of approved authenticated user IDs. */
export async function isModerator(userId: string) {
  const env = await getRuntimeEnv();
  const configured = String(env.TRINQUE_ADMIN_IDENTITY_HASHES ?? process.env.TRINQUE_ADMIN_IDENTITY_HASHES ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return configured.includes(await sha256(userId));
}
