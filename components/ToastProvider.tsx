"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type ToastContextValue = { flash: (text: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Transient confirmations ("saved", "vote recorded"). One live region for the
 * whole app, so an announcement is never lost to a route change and screens do
 * not each invent their own.
 *
 * Anything the user must act on belongs beside the control that failed, not
 * here — a toast that disappears is not an error message.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((next: string) => {
    setText(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(""), 2600);
  }, []);

  const value = useMemo(() => ({ flash }), [flash]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {text && <div className="toast"><Icon name="check" size={16} />{text}</div>}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}
