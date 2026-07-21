"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiLanguage, useUiText } from "@/components/useUiText";

type Item = { id: string; label: string; handle?: string | null };
type Report = { id: string; targetType: string; reason: string; status: "open" | "resolved" | "rejected"; createdAt: string };

export function SafetyCenter() {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const language = useUiLanguage();
  const [choices, setChoices] = useState<{ blocks: Item[]; mutes: Item[]; hiddenDishes: Item[] }>({ blocks: [], mutes: [], hiddenDishes: [] });
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!authenticated) return;
    try {
      const [safetyResponse, reportResponse] = await Promise.all([
        fetch("/api/safety", { headers: authHeaders(), cache: "no-store" }),
        fetch("/api/reports", { headers: authHeaders(), cache: "no-store" }),
      ]);
      if (!safetyResponse.ok || !reportResponse.ok) throw new Error("load failed");
      const safety = await safetyResponse.json() as typeof choices;
      const reportData = await reportResponse.json() as { reports?: Report[] };
      setChoices(safety); setReports(reportData.reports ?? []);
    } catch { setStatus(t("safety.failed")); }
  }, [authenticated, authHeaders, t]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void Promise.all([fetch("/api/safety", { headers: authHeaders(), cache: "no-store" }), fetch("/api/reports", { headers: authHeaders(), cache: "no-store" })]).then(async ([safetyResponse, reportResponse]) => {
      if (!safetyResponse.ok || !reportResponse.ok) throw new Error("load failed");
      const safety = await safetyResponse.json() as typeof choices;
      const reportData = await reportResponse.json() as { reports?: Report[] };
      if (active) { setChoices(safety); setReports(reportData.reports ?? []); }
    }).catch(() => { if (active) setStatus(t("safety.failed")); });
    return () => { active = false; };
  }, [authenticated, authHeaders, t]);

  async function undo(action: "block" | "mute" | "hide", targetId: string) {
    const response = await fetch(`/api/safety?action=${action}&targetId=${encodeURIComponent(targetId)}`, { method: "DELETE", headers: authHeaders() });
    setStatus(response.ok ? t("safety.done") : t("safety.failed"));
    if (response.ok) await load();
  }

  const lists: Array<{ key: keyof typeof choices; title: Parameters<typeof t>[0]; action: "block" | "mute" | "hide"; undo: Parameters<typeof t>[0] }> = [
    { key: "blocks", title: "safety.blocked", action: "block", undo: "safety.unblock" },
    { key: "mutes", title: "safety.muted", action: "mute", undo: "safety.unmute" },
    { key: "hiddenDishes", title: "safety.hidden", action: "hide", undo: "safety.unhide" },
  ];

  if (!authenticated) return null;
  return <section className="account-card account-card-wide"><span className="kicker">{t("safety.manage")}</span>
    {lists.map((list) => <div key={list.key}><h2>{t(list.title)}</h2><div className="safety-list">{choices[list.key].length ? choices[list.key].map((item) => <div className="safety-list-row" key={item.id}><span><b>{item.label}</b>{item.handle && <small>@{item.handle}</small>}</span><button className="text-button" onClick={() => void undo(list.action, item.id)}>{t(list.undo)}</button></div>) : <p>{t("safety.none")}</p>}</div></div>)}
    <div><h2>{t("safety.reports")}</h2><div className="safety-list">{reports.length ? reports.map((report) => <div className="safety-list-row" key={report.id}><span><b>{t(`safety.reason.${report.reason}` as Parameters<typeof t>[0])}</b><small>{new Date(report.createdAt).toLocaleString(language)}</small></span><span>{t(report.status === "open" ? "safety.open" : "safety.resolved")}</span></div>) : <p>{t("safety.none")}</p>}</div></div>
    {status && <p role="status">{status}</p>}
  </section>;
}
