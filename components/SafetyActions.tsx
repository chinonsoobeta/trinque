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
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<"harmful" | "spam" | "false" | "stale" | "other">(targetType === "dish" ? "stale" : "harmful");
  const [details, setDetails] = useState("");
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

  async function report() {
    await act("/api/reports", { targetType, targetId, reason, details: details.trim() });
    setReportOpen(false); setDetails("");
  }

  function block() {
    if (window.confirm(t("safety.blockConfirm"))) void act("/api/safety", { action: "block", targetId: userId! });
  }

  return <div className="modal-actions safety-actions" aria-label={t("safety.title")}>
    <button className="text-button" disabled={busy} onClick={() => setReportOpen((value) => !value)}>{t(targetType === "dish" ? "safety.reportDish" : targetType === "comment" ? "safety.reportComment" : "safety.reportUser")}</button>
    {allowHide && <button className="text-button" disabled={busy} onClick={() => void act("/api/safety", { action: "hide", targetId })}>{t("safety.hideDish")}</button>}
    {userId && <><button className="text-button" disabled={busy} onClick={() => void act("/api/safety", { action: "mute", targetId: userId })}>{t("safety.muteUser")}</button><button className="text-button" disabled={busy} onClick={block}>{t("safety.blockUser")}</button></>}
    {reportOpen && <div className="safety-report-form"><label>{t("safety.reportReason")}<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{(["harmful", "spam", "false", "stale", "other"] as const).map((value) => <option key={value} value={value}>{t(`safety.reason.${value}`)}</option>)}</select></label><label>{t("safety.details")}<textarea maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} /></label><div><button className="primary" disabled={busy} onClick={() => void report()}>{t("safety.submitReport")}</button><button className="text-button" disabled={busy} onClick={() => setReportOpen(false)}>{t("safety.cancel")}</button></div></div>}
    {status && <span role="status">{status}</span>}
  </div>;
}
