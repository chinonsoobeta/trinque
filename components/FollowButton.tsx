"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export function FollowButton({ handle, initialFollowing, initialCount, onChange }: { handle: string; initialFollowing: boolean; initialCount: number; onChange?: (state: { following: boolean; count: number }) => void }) {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (busy) return;
    const previous = { following, count };
    const optimistic = { following: !following, count: Math.max(0, count + (following ? -1 : 1)) };
    setFollowing(optimistic.following); setCount(optimistic.count); setBusy(true); onChange?.(optimistic);
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(handle)}/follow`, { method: previous.following ? "DELETE" : "POST", headers: authHeaders() });
      if (!response.ok) throw new Error("follow failed");
      const payload = await response.json() as { following: boolean; count: number };
      setFollowing(payload.following); setCount(payload.count); onChange?.(payload);
    } catch {
      setFollowing(previous.following); setCount(previous.count); onChange?.(previous);
    } finally { setBusy(false); }
  }

  return <button className={following ? "secondary" : "primary"} disabled={busy} onClick={() => void toggle()}>{following ? t("social.following") : t("social.follow")} · {count}</button>;
}
