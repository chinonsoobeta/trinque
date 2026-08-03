import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "dish-images";

let cached: SupabaseClient | null = null;

export function uploadsBucket(): string {
  return process.env.SUPABASE_UPLOADS_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function uploadsConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

// Writes and private reads use the service-role key, so this client must never
// be constructed in code that reaches the browser.
function storage() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  cached ??= createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached.storage.from(uploadsBucket());
}

export async function storeDishImage(dataUrl: string, ownerId: string): Promise<string | null> {
  const decoded = decodeDishImage(dataUrl);
  const bucket = storage();
  if (!bucket) throw new Error("uploads_unavailable");
  const extension = decoded.contentType === "image/png" ? "png" : decoded.contentType === "image/webp" ? "webp" : "jpg";
  const key = `${ownerId}-${crypto.randomUUID()}.${extension}`;
  const { error } = await bucket.upload(key, decoded.bytes, { contentType: decoded.contentType, upsert: false });
  if (error) throw new Error("uploads_unavailable");
  return key;
}

export function decodeDishImage(dataUrl: string): { contentType: "image/jpeg" | "image/png" | "image/webp"; bytes: Uint8Array } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || dataUrl.length > 7_000_000) throw new Error("invalid_image");
  let binary: string;
  try { binary = atob(match[2]); } catch { throw new Error("invalid_image"); }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength === 0 || bytes.byteLength > 5_000_000 || !signatureMatches(match[1], bytes)) throw new Error("invalid_image");
  return { contentType: match[1] as "image/jpeg" | "image/png" | "image/webp", bytes };
}

function signatureMatches(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export type StoredDishImage = { body: ArrayBuffer; contentType: string; etag: string };

export async function getDishImage(key: string): Promise<StoredDishImage | null> {
  const bucket = storage();
  if (!bucket) return null;
  const { data, error } = await bucket.download(key);
  if (error || !data) return null;
  const body = await data.arrayBuffer();
  // R2 supplied an ETag for free; Supabase Storage does not surface one through
  // the SDK, so derive a stable validator from the immutable key and size.
  return { body, contentType: data.type || "application/octet-stream", etag: `"${key}-${body.byteLength}"` };
}

export async function deleteDishImage(key: string): Promise<boolean> {
  const bucket = storage();
  if (!bucket) return false;
  const { error } = await bucket.remove([key]);
  return !error;
}
