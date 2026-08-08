import Image, { type ImageProps } from "next/image";

/**
 * Feed and match payloads carry absolute media URLs because the iOS client
 * consumes the same endpoints and has no origin of its own. On the web those
 * assets are same-origin, so reduce them to a path: `next/image` only resizes
 * and re-encodes sources it recognises as local.
 */
export function localMediaPath(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  return path.startsWith("/api/") ? path : url;
}

/** A 1×1 image in the app's ground colour, held behind the photo while it decodes. */
const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjMiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9IiMyMTE3MWEiLz48L3N2Zz4=";

/**
 * An image from Trinque's own media endpoints. Optimised and blurred-up when
 * the source is local; passed through untouched when it is not, so a third-party
 * photo never fails the build's remote-pattern check.
 */
export function MediaImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  const resolved = localMediaPath(src);
  const local = resolved.startsWith("/");
  return <Image
    src={resolved}
    alt={alt}
    unoptimized={!local}
    placeholder={local ? "blur" : undefined}
    blurDataURL={local ? PLACEHOLDER : undefined}
    {...props}
  />;
}
