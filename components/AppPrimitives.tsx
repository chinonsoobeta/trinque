import Image from "next/image";
import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`page-container ${className}`.trim()}>{children}</main>;
}

export function AppAvatar({ name, src, size = "medium" }: { name: string; src?: string | null; size?: "small" | "medium" | "large" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "T";
  return <span className={`app-avatar app-avatar-${size}`} aria-hidden="true">{src ? <Image src={src} alt="" width={96} height={96} sizes="96px" unoptimized /> : initials}</span>;
}

export function EmptyState({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body: string; action?: ReactNode }) {
  return <section className="app-empty-state">{eyebrow && <span className="kicker">{eyebrow}</span>}<span className="empty-mark" aria-hidden="true">✦</span><h2>{title}</h2><p>{body}</p>{action && <div className="empty-actions">{action}</div>}</section>;
}

export function LoadingState({ label }: { label: string }) {
  return <div className="app-loading-state" role="status" aria-live="polite"><span className="loading-dot" aria-hidden="true" /><span>{label}</span></div>;
}
