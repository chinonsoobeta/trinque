"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export function AccountPrivacyActions() {
  const { authHeaders, signOut } = useAuth();
  const t = useUiText();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function exportAccount() {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/privacy/social", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) { setStatus(t("error.generic")); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trinque-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(t("privacy.exportReady"));
    } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!window.confirm(t("privacy.deleteConfirm"))) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/privacy/social", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) { setStatus(t("error.generic")); return; }
      window.localStorage.removeItem("trinque.sessionToken");
      window.localStorage.removeItem("trinque.guestToken");
      await signOut();
      window.location.assign("/");
    } finally { setBusy(false); }
  }

  return <div className="account-privacy-actions">
    <button className="text-button full" disabled={busy} onClick={() => void exportAccount()}>{t("privacy.export")}</button>
    <button className="text-button full" disabled={busy} onClick={() => void deleteAccount()}>{t("privacy.delete")}</button>
    {status && <p className="privacy-note" role="status">{status}</p>}
  </div>;
}
