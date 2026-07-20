"use client";

import { useCallback, useEffect, useState } from "react";
import { NotificationList } from "@/components/NotificationList";
import { useAuth } from "@/components/AuthProvider";

export function NotificationBell() {
  const { authenticated, authHeaders } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (!authenticated) return;
    const response = await fetch("/api/notifications/count", { headers: authHeaders(), cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json() as { count: number };
      setCount(payload.count);
    }
  }, [authenticated, authHeaders]);
  useEffect(() => {
  if (!authenticated) return;

  const controller = new AbortController();

  void fetch("/api/notifications/count", {
    headers: authHeaders(),
    cache: "no-store",
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) return;

      const payload = (await response.json()) as { count: number };

      if (!controller.signal.aborted) {
        setCount(payload.count);
      }
    })
    .catch((error: unknown) => {
      // Aborting on unmount/auth changes is expected.
      if (error instanceof DOMException && error.name === "AbortError") return;
    });

  return () => controller.abort();
}, [authenticated, authHeaders]);
  if (!authenticated) return null;
  return <div className="notification-bell"><button aria-label={`${count} unread notifications`} onClick={() => setOpen((value) => !value)}>♢{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</button>{open && <div className="notification-popover"><NotificationList onRead={() => void refresh()} /></div>}</div>;
}
