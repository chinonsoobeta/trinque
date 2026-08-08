import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "dish-images";

export type StoredObjectMetadata = { contentType?: string; cacheControl?: string };

export type StoredObject = {
  bytes: ArrayBuffer;
  httpMetadata: StoredObjectMetadata;
};

/**
 * The subset of the Cloudflare R2 bucket surface the app actually used, kept so
 * the calling routes did not have to change shape when uploads moved to
 * Supabase Storage.
 */
export type ObjectBucket = {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: StoredObjectMetadata }): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
};

export function storageBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getObjectBucket(): ObjectBucket | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;

  // The service role key bypasses row level security, so this client must never
  // be constructed in code that reaches the browser, and it must not try to
  // persist or refresh a user session.
  const bucket = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    .storage
    .from(storageBucketName());

  return {
    async put(key, value, options) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      const { error } = await bucket.upload(key, bytes, {
        contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
        cacheControl: cacheControlSeconds(options?.httpMetadata?.cacheControl),
        upsert: false,
      });
      if (error) throw new Error(`storage_put_failed: ${error.message}`);
    },
    async get(key) {
      const { data, error } = await bucket.download(key);
      if (error || !data) return null;
      return {
        bytes: await data.arrayBuffer(),
        httpMetadata: { contentType: data.type || "application/octet-stream" },
      };
    },
    async delete(key) {
      const { error } = await bucket.remove([key]);
      if (error) throw new Error(`storage_delete_failed: ${error.message}`);
    },
  };
}

/** Supabase Storage takes a max-age in seconds rather than a Cache-Control string. */
function cacheControlSeconds(cacheControl: string | undefined): string | undefined {
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
  return maxAge ?? undefined;
}
