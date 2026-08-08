"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { useUiText } from "@/components/useUiText";

/**
 * Optimistic like `LikeButton`, and for the same reason: the outcome is almost
 * always success, so the button reflects the choice immediately and rolls back
 * only if the write actually fails.
 *
 * It never fetches on mount — the feed payload carries `viewerSaved`.
 */
export function SaveButton({ dishId, initialSaved = false, onChange }: { dishId: string; initialSaved?: boolean; onChange?: (saved: boolean) => void }) {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (busy) return;
    const previous = saved;
    setSaved(!previous); setBusy(true);
    try {
      const response = await fetch("/api/saves", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ dishId, saved: !previous }),
      });
      if (!response.ok) throw new Error("save failed");
      onChange?.(!previous);
    } catch { setSaved(previous); }
    finally { setBusy(false); }
  }

  return <button className={saved ? "save saved" : "save"} disabled={busy} onClick={() => void toggle()} aria-label={t(saved ? "dish.unsave" : "dish.save")} aria-pressed={saved}><Icon name={saved ? "savedFilled" : "saved"} size={18} /></button>;
}
