"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function AccountPrivacyActions() {
  const { authHeaders, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function exportAccount() {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/privacy/social", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) { setStatus("We could not export your account data."); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trinque-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Your account data was downloaded.");
    } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account data, dishes, comments, group plans, and sign-in sessions? You cannot undo this.")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/privacy/social", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; setStatus(payload.error ?? "We could not delete your account."); return; }
      window.localStorage.removeItem("trinque.sessionToken");
      window.localStorage.removeItem("trinque.guestToken");
      await signOut();
      window.location.assign("/");
    } finally { setBusy(false); }
  }

  return <div className="account-privacy-actions">
    <button className="text-button full" disabled={busy} onClick={() => void exportAccount()}>Download my data</button>
    <button className="text-button full" disabled={busy} onClick={() => void deleteAccount()}>Delete account</button>
    {status && <p className="privacy-note" role="status">{status}</p>}
  </div>;
}
