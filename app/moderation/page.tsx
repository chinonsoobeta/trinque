"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/AppPrimitives";
import { useAuth } from "@/components/AuthProvider";
import { useUiLanguage, useUiText } from "@/components/useUiText";

type Report = { id: string; targetType: "user" | "dish" | "comment"; targetId: string; reason: "harmful" | "spam" | "false" | "stale" | "other"; details: string; createdAt: string };
type Action = "hide" | "remove" | "restore" | "resolve" | "reject";

export default function ModerationPage() {
  const { authenticated, loading, authHeaders } = useAuth();
  const t = useUiText();
  const language = useUiLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (loading || !authenticated) return;
    let active = true;
    void fetch("/api/moderation", { headers: authHeaders(), cache: "no-store" }).then(async (response) => {
      if (!active) return;
      if (response.status === 403) { setDenied(true); return; }
      if (!response.ok) { setStatus(t("safety.failed")); return; }
      const payload = await response.json() as { reports?: Report[] };
      setReports(payload.reports ?? []);
    });
    return () => { active = false; };
  }, [authenticated, authHeaders, loading, t]);

  async function decide(reportId: string, action: Action) {
    const response = await fetch("/api/moderation", { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ reportId, action, reason: note[reportId]?.trim() ?? "" }) });
    setStatus(response.ok ? t("safety.done") : t("safety.failed"));
    if (response.ok) setReports((current) => current.filter((report) => report.id !== reportId));
  }

  if (denied || (!loading && !authenticated)) return <PageContainer><p>{t("moderation.denied")}</p></PageContainer>;
  return <PageContainer className="account-page"><header className="page-hero compact"><h1>{t("moderation.title")}</h1><p>{t("moderation.help")}</p></header>
    <div className="safety-list">{reports.length ? reports.map((report) => <article className="account-card" key={report.id}><h2>{t(`safety.reason.${report.reason}`)}</h2><p>{t(report.targetType === "dish" ? "analysis.field.name" : report.targetType === "comment" ? "comments.title" : "nav.profile")} · {report.targetId}</p>{report.details && <p>{report.details}</p>}<small>{new Date(report.createdAt).toLocaleString(language)}</small><label>{t("moderation.reason")}<textarea maxLength={1000} value={note[report.id] ?? ""} onChange={(event) => setNote((current) => ({ ...current, [report.id]: event.target.value }))} /></label><div className="modal-actions">{(["hide", "remove", "restore", "resolve", "reject"] as const).map((action) => <button className={action === "remove" ? "primary" : "secondary"} key={action} onClick={() => void decide(report.id, action)}>{t(`moderation.${action}`)}</button>)}</div></article>) : <p>{t("moderation.empty")}</p>}</div>{status && <p role="status">{status}</p>}
  </PageContainer>;
}
