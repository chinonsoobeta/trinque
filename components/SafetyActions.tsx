"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

type Props = { targetType: "dish" | "user" | "comment"; targetId: string; userId?: string; allowHide?: boolean };

export function SafetyActions({ targetType, targetId, userId, allowHide = false }: Props) {
  const { authenticated, authHeaders, identity } = useAuth();
  const t = useUiText();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  if (identity?.id === userId) return null;

  async function act(path: string, body: Record<string, string>) {
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(true); setStatus("");
    try {
      const response = await fetch(path, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setStatus(response.ok ? t("safety.done") : t("safety.failed"));
      if (response.ok && body.action === "hide") window.location.assign("/explore");
    } catch { setStatus(t("safety.failed")); }
    finally { setBusy(false); }
  }

  return <div className="modal-actions safety-actions" aria-label={t("safety.title")}>
    <button className="text-button" disabled={busy} onClick={() => void act("/api/reports", { targetType, targetId, reason: targetType === "dish" ? "stale" : "harmful" })}>{t(targetType === "dish" ? "safety.reportDish" : targetType === "comment" ? "safety.reportComment" : "safety.reportUser")}</button>
    {allowHide && <button className="text-button" disabled={busy} onClick={() => void act("/api/safety", { action: "hide", targetId })}>{t("safety.hideDish")}</button>}
    {userId && <><button className="text-button" disabled={busy} onClick={() => void act("/api/safety", { action: "mute", targetId: userId })}>{t("safety.muteUser")}</button><button className="text-button" disabled={busy} onClick={() => void act("/api/safety", { action: "block", targetId: userId })}>{t("safety.blockUser")}</button></>}
    {status && <span role="status">{status}</span>}
  </div>;
}
