"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export function PrivacySettings() {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const [consent, setConsent] = useState({ locationConsent: false, analyticsConsent: false, imageRetentionConsent: false });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    void fetch("/api/privacy", { headers: authHeaders() }).then(async (response) => { if (response.ok) setConsent((await response.json() as { consent: typeof consent }).consent); });
  }, [authenticated, authHeaders]);

  async function saveConsent(next = consent) {
    if (!authenticated) return;
    setBusy(true);
    try { const response = await fetch("/api/privacy", { method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(next) }); if (!response.ok) throw new Error(); setConsent((await response.json() as { consent: typeof consent }).consent); }
    catch { setStatus(t("error.generic")); } finally { setBusy(false); }
  }

  async function exportData() {
    if (!authenticated) return;
    const response = await fetch("/api/privacy/export", { headers: authHeaders() });
    if (!response.ok) { setStatus(t("error.generic")); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "trinque-data-export.json"; link.click(); URL.revokeObjectURL(url); setStatus(t("privacy.exportReady"));
  }

  async function deleteData() {
    if (!authenticated || !window.confirm(t("privacy.deleteConfirm"))) return;
    const response = await fetch("/api/privacy", { method: "DELETE", headers: authHeaders() });
    if (!response.ok) { setStatus(t("error.generic")); return; }
    for (const key of ["trinque.sessionToken", "trinque.location", "trinque.language", "trinque.theme", "trinque.measurement"]) window.localStorage.removeItem(key); window.location.reload();
  }

  if (!authenticated) return null;
  return <div className="setting-block"><span>{t("privacy.title")}</span>{([['locationConsent', 'privacy.locationConsent'], ['analyticsConsent', 'privacy.analyticsConsent'], ['imageRetentionConsent', 'privacy.imageConsent']] as const).map(([field, key]) => <label className="confirmation" key={field}><input type="checkbox" checked={consent[field]} onChange={(event) => setConsent((current) => ({ ...current, [field]: event.target.checked }))} />{t(key)}</label>)}{status && <p role="status">{status}</p>}<button className="location-chip" disabled={busy || !authenticated} onClick={() => void saveConsent()}>{t("privacy.saveConsent")}</button><button className="text-button full" disabled={busy || !authenticated} onClick={() => { const withdrawn = { locationConsent: false, analyticsConsent: false, imageRetentionConsent: false }; setConsent(withdrawn); void saveConsent(withdrawn); }}>{t("privacy.withdraw")}</button><button className="secondary full" disabled={!authenticated} onClick={() => void exportData()}>{t("privacy.export")}</button><button className="text-button full" disabled={!authenticated} onClick={() => void deleteData()}>{t("privacy.delete")}</button></div>;
}
