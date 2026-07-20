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
      if (!response.ok) { setStatus("Unable to export account data."); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trinque-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Account export downloaded.");
    } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your Trinque account data, dishes, comments, social activity, groups, and sessions? This cannot be undone.")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/privacy/social", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; setStatus(payload.error ?? "Unable to delete account."); return; }
      window.localStorage.removeItem("trinque.sessionToken");
      window.localStorage.removeItem("trinque.guestToken");
      await signOut();
      window.location.assign("/");
    } finally { setBusy(false); }
  }

  return <div className="account-privacy-actions">
    <button className="text-button full" disabled={busy} onClick={() => void exportAccount()}>Export account data</button>
    <button className="text-button full" disabled={busy} onClick={() => void deleteAccount()}>Delete account</button>
    {status && <p className="privacy-note" role="status">{status}</p>}
  </div>;
}
