"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { MessageKey } from "@/ios/i18n";
import { useUiLanguage, useUiText } from "@/components/useUiText";

type Item = { id: string; label: string; handle?: string | null };
type Report = { id: string; targetType: string; reason: string; status: "open" | "resolved" | "rejected"; createdAt: string };

export function SafetyCenter() {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const language = useUiLanguage();
  const [choices, setChoices] = useState<{ blocks: Item[]; mutes: Item[]; hiddenDishes: Item[] }>({ blocks: [], mutes: [], hiddenDishes: [] });
  const [reports, setReports] = useState<Report[]>([]);
  // A message key, not a translated string: holding the translation would put
  // `t` in the load dependencies, and that identity changes when the language
  // store hydrates — which refetched the whole safety centre a second time.
  const [statusKey, setStatusKey] = useState<MessageKey | null>(null);

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
    } catch { setStatusKey("safety.failed"); }
  }, [authenticated, authHeaders]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void Promise.all([fetch("/api/safety", { headers: authHeaders(), cache: "no-store" }), fetch("/api/reports", { headers: authHeaders(), cache: "no-store" })]).then(async ([safetyResponse, reportResponse]) => {
      if (!safetyResponse.ok || !reportResponse.ok) throw new Error("load failed");
      const safety = await safetyResponse.json() as typeof choices;
      const reportData = await reportResponse.json() as { reports?: Report[] };
      if (active) { setChoices(safety); setReports(reportData.reports ?? []); }
    }).catch(() => { if (active) setStatusKey("safety.failed"); });
    return () => { active = false; };
  }, [authenticated, authHeaders]);

  async function undo(action: "block" | "mute" | "hide", targetId: string) {
    const response = await fetch(`/api/safety?action=${action}&targetId=${encodeURIComponent(targetId)}`, { method: "DELETE", headers: authHeaders() });
    setStatusKey(response.ok ? "safety.done" : "safety.failed");
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
    {statusKey && <p role="status">{t(statusKey)}</p>}
  </section>;
}
