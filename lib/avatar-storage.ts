import { getObjectBucket, type ObjectBucket, type StoredObject } from "./object-storage.ts";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type StoredAvatar = StoredObject;

export async function getImageBucket(): Promise<ObjectBucket> {
  const bucket = getObjectBucket();
  if (!bucket) throw new Error("No image storage bucket is configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return bucket;
}

export function avatarKey(userId: string, contentType: string): string {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/avif" ? "avif" : "jpg";
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  return `avatars/${safeUserId}/${crypto.randomUUID()}.${extension}`;
}

export function avatarUrlForKey(key: string): string {
  return `/api/profile/avatar?key=${encodeURIComponent(key)}`;
}

export function avatarKeyFromUrl(value: string | null | undefined): string | null {
  if (!value?.startsWith("/api/profile/avatar?")) return null;
  try {
    const url = new URL(value, "https://trinque.invalid");
    const key = url.searchParams.get("key");
    return key?.startsWith("avatars/") ? key : null;
  } catch {
    return null;
  }
}
