"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal panel: centred on a wide screen, a bottom sheet on a narrow one.
 *
 * It does the three things a dialog has to do and that ad-hoc overlays in this
 * app were not doing — close on Escape, keep Tab inside itself while open, and
 * return focus to whatever opened it — so keyboard and screen-reader users can
 * get back out of it.
 */
export function Sheet({ open, onClose, title, closeLabel, describedBy, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  describedBy?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const focusable = panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusable?.[0] ?? panel.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const titleId = `${title.replace(/\W+/g, "-").toLowerCase()}-sheet-title`;
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy} ref={panel} tabIndex={-1}>
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={closeLabel}><Icon name="close" size={18} /></button>
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <footer className="sheet-footer">{footer}</footer>}
    </div>
  </div>;
}
