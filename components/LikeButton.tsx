"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { useUiText } from "@/components/useUiText";

/**
 * `initialLiked` is deliberately optional rather than defaulted: a feed that
 * knows the viewer's state passes it and this button makes no request at all,
 * while a surface that does not know still asks once. Twenty cards used to mean
 * twenty round trips for something the feed query already had.
 */
export function LikeButton({ dishId, initialLiked, initialCount = 0 }: { dishId: string; initialLiked?: boolean; initialCount?: number }) {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const hydrated = initialLiked !== undefined;

  useEffect(() => {
    if (hydrated) return;
    let active = true;
    void fetch(`/api/dishes/${encodeURIComponent(dishId)}/like`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ liked: boolean; count: number }> : null)
      .then((payload) => { if (active && payload) { setLiked(payload.liked); setCount(payload.count); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, [authHeaders, authenticated, dishId, hydrated]);

  async function toggle() {
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (busy) return;
    const previousLiked = liked; const previousCount = count;
    setLiked(!liked); setCount(Math.max(0, count + (liked ? -1 : 1))); setBusy(true);
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}/like`, { method: previousLiked ? "DELETE" : "POST", headers: authHeaders() });
      if (!response.ok) throw new Error("like failed");
      const payload = await response.json() as { liked: boolean; count: number };
      setLiked(payload.liked); setCount(payload.count);
    } catch { setLiked(previousLiked); setCount(previousCount); }
    finally { setBusy(false); }
  }

  return <button className={liked ? "save saved" : "save"} disabled={busy} onClick={() => void toggle()} aria-label={t(liked ? "dish.unlike" : "dish.like")} aria-pressed={liked}><Icon name={liked ? "liked" : "like"} size={18} /><span>{count}</span></button>;
}
