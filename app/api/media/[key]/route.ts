import { getDishImage } from "@/lib/uploads";


export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(key)) return new Response("Not found", { status: 404 });
  const object = await getDishImage(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.bytes, { headers });
}
