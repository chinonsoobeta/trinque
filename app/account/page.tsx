"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/AppPrimitives";
import { PrivacySettings } from "@/components/PrivacySettings";
import { SafetyCenter } from "@/components/SafetyCenter";
import { useAuth } from "@/components/AuthProvider";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import { LANGUAGE_LABEL_KEYS, UI_LANGUAGES } from "@/ios/i18n";

export default function AccountPage() {
  const { authenticated, identity, loading, authHeaders } = useAuth();
  const t = useUiText();
  const language = useUiLanguage();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!authenticated) return;
    void fetch("/api/notifications?limit=1&unread=true", { headers: authHeaders(), cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { notifications: unknown[]; total?: number };
      setNotificationCount(payload.total ?? payload.notifications.length);
    }).catch(() => undefined);
  }, [authenticated, authHeaders]);

  return <PageContainer className="account-page">
    <header className="page-hero compact"><span className="kicker">{t("nav.profile")}</span><h1>{t("auth.openAccount")}</h1></header>
    <div className="account-grid">

      <section className="account-card">
        <span className="kicker">{t("nav.profile")}</span>
        <h2>{loading ? t("onboarding.loading") : authenticated ? identity?.displayName : t("auth.guest")}</h2>
        {identity?.handle && <p className="privacy-note">@{identity.handle}</p>}
        <p>{t("profile.edit")}</p>
        {authenticated && identity?.handle ? <Link className="secondary button-link" href={`/profiles/${identity.handle}`}>{t("nav.profile")}</Link> : null}
      </section>

      <section className="account-card">
        <span className="kicker">{t("settings.title")}</span>
        <h2>{t("settings.language")}</h2>
        <div className="setting-options">{UI_LANGUAGES.map((item) => <button key={item} className={language === item ? "active" : ""} onClick={() => { window.localStorage.setItem("trinque.language", item); window.dispatchEvent(new Event("trinque:language")); }}>{t(LANGUAGE_LABEL_KEYS[item])}</button>)}</div>
      </section>

      <section className="account-card">
        <span className="kicker">{t("notifications.title")}</span>
        <h2>{notificationCount > 0 ? t("notifications.unread", { count: notificationCount }) : t("notifications.title")}</h2>
        <Link className="secondary button-link" href="/notifications">{t("notifications.title")}</Link>
      </section>

      <section className="account-card account-card-wide">
        <span className="kicker">{t("privacy.title")}</span>
        <PrivacySettings />
      </section>

      <SafetyCenter />
    </div>
  </PageContainer>;
}
