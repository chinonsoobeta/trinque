"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Notification = { id: string; type: "like" | "comment" | "follow" | "group_invite"; targetId: string | null; read: boolean; createdAt: string; actorDisplayName: string | null; actorHandle: string | null };

export function NotificationList({ onRead }: { onRead?: () => void }) {
  const { authHeaders } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=50", { headers: authHeaders(), cache: "no-store" });
      if (response.ok) {
        const payload = await response.json() as { notifications: Notification[] };
        setItems(payload.notifications);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);
  useEffect(() => { void load(); }, [load]);

  async function markRead(item: Notification) {
    if (!item.read) {
      setItems((current) => current.map((value) => value.id === item.id ? { ...value, read: true } : value));
      await fetch("/api/notifications", { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) }).catch(() => undefined);
      onRead?.();
    }
    const href = notificationHref(item);
    if (href) window.location.assign(href);
  }

  if (loading) return <p>Loading notifications…</p>;
  if (!items.length) return <div className="empty-state"><p>No notifications yet.</p></div>;
  return <div className="notification-list">{items.map((item) => <button key={item.id} className={item.read ? "notification read" : "notification unread"} onClick={() => void markRead(item)}><b>{item.actorDisplayName ?? "Someone"}</b> {copy(item.type)}<small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div>;
}

function copy(type: Notification["type"]) { return type === "like" ? "liked your dish" : type === "comment" ? "commented on your dish" : type === "follow" ? "followed you" : "invited you to a group"; }
function notificationHref(item: Notification) { if (item.type === "follow" && item.actorHandle) return `/profiles/${item.actorHandle}`; if ((item.type === "like" || item.type === "comment") && item.targetId) return `/dishes/${item.targetId}`; if (item.type === "group_invite" && item.targetId) return `/?join=${encodeURIComponent(item.targetId)}`; return null; }
