import type { SVGProps } from "react";

/**
 * The application icon set. Every glyph is drawn on a 24px grid and painted with
 * `currentColor`, so an icon takes the colour and size of the control it sits in.
 *
 * These replace the Unicode characters the UI used to use for navigation and
 * actions (⌕ ＋ ⌂ ♢ ○ ✦ ♥). Those rendered as a different typeface on every
 * platform, never aligned optically with adjacent text, and could not be
 * restyled.
 */
export type IconName =
  | "discover" | "explore" | "post" | "groups" | "profile" | "saved"
  | "like" | "liked" | "comment" | "bell" | "close" | "check" | "chevronRight"
  | "camera" | "settings" | "location" | "sparkle" | "share" | "eye" | "eyeOff" | "alert"
  | "arrowUp" | "wallet" | "savedFilled";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { name: IconName; size?: number; title?: string };

export function Icon({ name, size = 24, title, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

/** Google's mark, drawn in its four brand colours — it must not be recoloured. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.26-2.09 3.56-5.17 3.56-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.87 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  discover: <><path d="M3 10.2 12 3l9 7.2" /><path d="M5.5 8.8V20h13V8.8" /><path d="M9.75 20v-5.5h4.5V20" /></>,
  explore: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m20 20-4.4-4.4" /></>,
  post: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  groups: <><circle cx="9" cy="8.5" r="3.2" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.2 5.6a3.2 3.2 0 0 1 0 6.1" /><path d="M17.6 14.4A6.2 6.2 0 0 1 21.2 20" /></>,
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></>,
  saved: <path d="M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1Z" />,
  savedFilled: <path fill="currentColor" stroke="none" d="M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1Z" />,
  like: <path d="M12 20.3 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8A4.6 4.6 0 0 1 19.3 13Z" />,
  liked: <path fill="currentColor" stroke="none" d="M12 20.8 4.35 13.1a5.1 5.1 0 0 1 7.2-7.2l.45.45.45-.45a5.1 5.1 0 0 1 7.2 7.2Z" />,
  comment: <path d="M20.5 11.6a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.6-.4L4 20.5l1.4-4.5a7.7 7.7 0 0 1-1.4-4.4A7.9 7.9 0 0 1 12.3 3.7a7.9 7.9 0 0 1 8.2 7.9Z" />,
  bell: <><path d="M18 9.5a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" /><path d="M13.7 19.5a2 2 0 0 1-3.4 0" /></>,
  close: <><path d="M6 6 18 18" /><path d="M18 6 6 18" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  camera: <><path d="M3.5 8.5h3.2l1.4-2.2h7.8l1.4 2.2h3.2v11h-17Z" /><circle cx="12" cy="13.6" r="3.6" /></>,
  settings: <><circle cx="12" cy="12" r="3.1" /><path d="M19.4 14.4a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z" /></>,
  location: <><path d="M19 10.3c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10.2" r="2.7" /></>,
  sparkle: <path d="M12 3.2c.9 4.6 1.9 5.6 6.5 6.5-4.6.9-5.6 1.9-6.5 6.5-.9-4.6-1.9-5.6-6.5-6.5 4.6-.9 5.6-1.9 6.5-6.5Z" />,
  share: <><path d="M12 15.5V4" /><path d="m8 7.6 4-3.6 4 3.6" /><path d="M5.5 13.4V20h13v-6.6" /></>,
  eye: <><path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12Z" /><circle cx="12" cy="12" r="2.9" /></>,
  eyeOff: <><path d="M4 4.2 19.8 20" /><path d="M9.6 9.8a3 3 0 0 0 4.2 4.2" /><path d="M6.7 6.9C4.1 8.5 2.6 12 2.6 12S6 18.1 12 18.1a9 9 0 0 0 4.1-.98" /><path d="M18.4 15.1c1.9-1.5 3-3.1 3-3.1S18 5.9 12 5.9c-.6 0-1.2.06-1.7.17" /></>,
  alert: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.7v5" /><path d="M12 15.9h.01" /></>,
  arrowUp: <><path d="M12 19.5V5" /><path d="m5.8 11.2 6.2-6.2 6.2 6.2" /></>,
  wallet: <><path d="M3.8 7.6h13.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" /><path d="M3.8 7.6V6.4a1.8 1.8 0 0 1 1.8-1.8h9.6" /><path d="M15.6 13.5h.01" /></>,
};
