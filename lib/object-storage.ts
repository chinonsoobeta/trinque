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

/**
 * Auth and object storage can live in different Supabase projects, so storage
 * takes its own URL when one is set and otherwise shares the auth project's.
 */
function storageUrl(): string | undefined {
  return process.env.SUPABASE_STORAGE_URL?.trim() || process.env.SUPABASE_URL?.trim();
}

export function storageConfigured(): boolean {
  return Boolean(storageUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) || localBucketDirectory() !== null;
}

/**
 * A development-only directory that stands in for Supabase Storage, so the app can
 * be run end to end without production credentials. Deliberately gated on
 * NODE_ENV: a deployment that loses its storage credentials must keep failing
 * loudly rather than silently writing images onto an ephemeral filesystem.
 */
function localBucketDirectory(): string | null {
  const directory = process.env.LOCAL_OBJECT_STORAGE_DIR?.trim();
  if (!directory || process.env.NODE_ENV !== "development") return null;
  return directory;
}

export function getObjectBucket(): ObjectBucket | null {
  const url = storageUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    const directory = localBucketDirectory();
    return directory ? localBucket(directory) : null;
  }

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

/** Filesystem implementation of {@link ObjectBucket} for local development. */
function localBucket(directory: string): ObjectBucket {
  const resolve = async (key: string) => {
    const { join, normalize } = await import("node:path");
    // Keys reach this function from route parameters, so a traversal attempt
    // must not be able to read or write outside the bucket directory.
    const safe = normalize(key).replace(/^(\.\.[/\\])+/, "").replace(/[/\\]/g, "_");
    return join(directory, safe);
  };
  return {
    async put(key, value, options) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(directory, { recursive: true });
      const path = await resolve(key);
      await writeFile(path, value instanceof Uint8Array ? value : new Uint8Array(value));
      await writeFile(`${path}.type`, options?.httpMetadata?.contentType ?? "application/octet-stream");
    },
    async get(key) {
      const { readFile } = await import("node:fs/promises");
      const path = await resolve(key);
      try {
        const bytes = await readFile(path);
        const contentType = await readFile(`${path}.type`, "utf8").catch(() => "application/octet-stream");
        return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, httpMetadata: { contentType } };
      } catch { return null; }
    },
    async delete(key) {
      const { rm } = await import("node:fs/promises");
      const path = await resolve(key);
      await rm(path, { force: true });
      await rm(`${path}.type`, { force: true });
    },
  };
}

/** Supabase Storage takes a max-age in seconds rather than a Cache-Control string. */
function cacheControlSeconds(cacheControl: string | undefined): string | undefined {
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
  return maxAge ?? undefined;
}
