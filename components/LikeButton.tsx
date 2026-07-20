"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function LikeButton({ dishId, initialLiked = false, initialCount = 0 }: { dishId: string; initialLiked?: boolean; initialCount?: number }) {
  const { authenticated, authHeaders } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/dishes/${encodeURIComponent(dishId)}/like`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ liked: boolean; count: number }> : null)
      .then((payload) => { if (active && payload) { setLiked(payload.liked); setCount(payload.count); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, [authHeaders, authenticated, dishId]);

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

  return <button className={liked ? "save saved" : "save"} disabled={busy} onClick={() => void toggle()} aria-label={liked ? "Unlike dish" : "Like dish"}>{liked ? "♥" : "♡"} {count}</button>;
}
