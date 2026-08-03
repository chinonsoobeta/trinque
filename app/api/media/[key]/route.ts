import { getDishImage } from "@/lib/uploads";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(key)) return new Response("Not found", { status: 404 });
  const object = await getDishImage(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, no-store",
      "ETag": object.etag,
    },
  });
}
