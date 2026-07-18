export async function storeDishImage(dataUrl: string, ownerId: string): Promise<string | null> {
  const decoded = decodeDishImage(dataUrl);
  const { env } = await import("cloudflare:workers");
  if (!env.UPLOADS) throw new Error("uploads_unavailable");
  const extension = decoded.contentType === "image/png" ? "png" : decoded.contentType === "image/webp" ? "webp" : "jpg";
  const key = `${ownerId}-${crypto.randomUUID()}.${extension}`;
  await env.UPLOADS.put(key, decoded.bytes, { httpMetadata: { contentType: decoded.contentType } });
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

export async function getDishImage(key: string) {
  const { env } = await import("cloudflare:workers");
  return env.UPLOADS?.get(key) ?? null;
}

export async function deleteDishImage(key: string): Promise<boolean> {
  const { env } = await import("cloudflare:workers");
  if (!env.UPLOADS) return false;
  await env.UPLOADS.delete(key);
  return true;
}
