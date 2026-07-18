export async function storeDishImage(dataUrl: string, ownerId: string): Promise<string | null> {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || dataUrl.length > 7_000_000) return null;
  const { env } = await import("cloudflare:workers");
  if (!env.UPLOADS) return null;
  const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
  const key = `${ownerId}-${crypto.randomUUID()}.${extension}`;
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: match[1] } });
  return key;
}

export async function getDishImage(key: string) {
  const { env } = await import("cloudflare:workers");
  return env.UPLOADS?.get(key) ?? null;
}
