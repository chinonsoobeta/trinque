import { getRuntimeEnv } from "@/lib/runtime-env";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type R2ObjectLike = {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: { contentType?: string; cacheControl?: string };
};

type R2BucketLike = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  head?(key: string): Promise<unknown>;
  createMultipartUpload?(key: string, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export async function getImageBucket(): Promise<R2BucketLike> {
  const env = await getRuntimeEnv() as unknown as Record<string, unknown>;
  const preferred = ["DISH_IMAGES", "IMAGES", "IMAGE_BUCKET", "R2_BUCKET", "BUCKET"];
  for (const name of preferred) {
    const candidate = env[name];
    if (isR2Bucket(candidate)) return candidate;
  }
  for (const candidate of Object.values(env)) if (isR2Bucket(candidate)) return candidate;
  throw new Error("No Cloudflare R2 image bucket binding is configured.");
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

function isR2Bucket(value: unknown): value is R2BucketLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<R2BucketLike>;
  const hasR2SpecificMethod = typeof candidate.head === "function" || typeof candidate.createMultipartUpload === "function";
  return hasR2SpecificMethod && typeof candidate.put === "function" && typeof candidate.get === "function" && typeof candidate.delete === "function";
}
