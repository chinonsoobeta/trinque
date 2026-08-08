import Image from "next/image";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/Icon";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`page-container ${className}`.trim()}>{children}</main>;
}

export function PageHeader({ eyebrow, title, body, actions, compact = false }: { eyebrow?: string; title: string; body?: string; actions?: ReactNode; compact?: boolean }) {
  return <header className={`page-hero${compact ? " compact" : ""}`}>
    {eyebrow && <span className="kicker">{eyebrow}</span>}
    <h1>{title}</h1>
    {body && <p>{body}</p>}
    {actions && <div className="page-hero-actions">{actions}</div>}
  </header>;
}

export function AppAvatar({ name, src, size = "medium" }: { name: string; src?: string | null; size?: "small" | "medium" | "large" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "T";
  const pixels = size === "large" ? 216 : size === "medium" ? 96 : 68;
  return <span className={`app-avatar app-avatar-${size}`} aria-hidden="true">{src ? <Image src={src} alt="" width={pixels} height={pixels} sizes={`${pixels / 2}px`} /> : initials}</span>;
}

export function EmptyState({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body: string; action?: ReactNode }) {
  return <section className="app-empty-state">{eyebrow && <span className="kicker">{eyebrow}</span>}<Icon name="sparkle" size={34} className="empty-mark" /><h2>{title}</h2><p>{body}</p>{action && <div className="empty-actions">{action}</div>}</section>;
}

export function LoadingState({ label }: { label: string }) {
  return <div className="app-loading-state" role="status" aria-live="polite"><span className="loading-dot" aria-hidden="true" /><span>{label}</span></div>;
}

/**
 * A placeholder shaped like the content it stands in for, so a screen reserves
 * its final layout while loading instead of reflowing when data lands.
 * Decorative by definition: the surrounding region carries the live message.
 */
export function Skeleton({ variant = "text", count = 1 }: { variant?: "text" | "title" | "card" | "avatar"; count?: number }) {
  return <>{Array.from({ length: count }, (_, index) => <span key={index} className={`skeleton skeleton-${variant}`} aria-hidden="true" />)}</>;
}

/**
 * Carries `social-feed` so the placeholders sit in the same grid, at the same
 * card size, as the dishes that replace them. A spinner and the word "Loading"
 * reserve no space at all, which is why the feed used to arrive and shove
 * everything below it down the page.
 */
export function SkeletonFeed({ label, count = 3 }: { label: string; count?: number }) {
  return <div className="feed social-feed" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <article key={index} className="skeleton-card" aria-hidden="true">
      <span className="skeleton skeleton-card" />
      <div className="skeleton-card-body"><Skeleton variant="avatar" /><Skeleton variant="title" /><Skeleton variant="text" count={2} /></div>
    </article>)}
  </div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "medium";
  busy?: boolean;
  full?: boolean;
};

export function Button({ variant = "secondary", size = "medium", busy = false, full = false, className = "", children, disabled, ...props }: ButtonProps) {
  return <button
    className={`btn btn-${variant} btn-${size}${full ? " btn-full" : ""} ${className}`.trim()}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    {...props}
  >{children}</button>;
}

/**
 * One labelled form control. Errors are wired to the input with
 * `aria-describedby` and announced, so a validation failure reaches a screen
 * reader rather than only appearing in colour.
 */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return <div className={`field${error ? " field-invalid" : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <small id={hintId} className="field-hint">{hint}</small>}
    {error && <small id={errorId} className="field-error" role="alert"><Icon name="alert" size={14} />{error}</small>}
  </div>;
}

export function Card({ children, className = "", as: Element = "section" }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" }) {
  return <Element className={`card ${className}`.trim()}>{children}</Element>;
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

/**
 * A single-select tab strip. Arrow keys move between tabs the way the WAI-ARIA
 * pattern expects, and only the active tab is in the tab order.
 */
export function Tabs<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="tabs" role="tablist" aria-label={label}>
    {options.map((option, index) => <button
      key={option.value}
      role="tab"
      type="button"
      aria-selected={option.value === value}
      tabIndex={option.value === value ? 0 : -1}
      className={option.value === value ? "active" : ""}
      onKeyDown={(event) => {
        const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!direction) return;
        event.preventDefault();
        onChange(options[(index + direction + options.length) % options.length].value);
      }}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>;
}
