"use client";

import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { PageContainer } from "@/components/AppPrimitives";
import { useAuth } from "@/components/AuthProvider";
import { SafetyCenter } from "@/components/SafetyCenter";
import { useUiText } from "@/components/useUiText";

export default function AccountPage() {
  const { authenticated, identity, loading } = useAuth();
  const t = useUiText();
  return <PageContainer className="account-page">
    <header className="page-hero compact"><span className="kicker">{t("nav.profile")}</span><h1>{t("auth.openAccount")}</h1></header>
    <div className="account-grid">
      <section className="account-card">
        <span className="kicker">{t("nav.profile")}</span>
        <h2>{loading ? t("onboarding.loading") : authenticated ? identity?.displayName : t("auth.guest")}</h2>
        <p>{t("profile.edit")}</p>
        {authenticated && identity?.handle ? <Link className="secondary button-link" href={`/profiles/${identity.handle}`}>{t("nav.profile")}</Link> : null}
      </section>

      <section className="account-card">
        <span className="kicker">{t("settings.title")}</span>
        <h2>{t("settings.language")} · {t("settings.theme")} · {t("settings.measurement")}</h2>
        <Link className="secondary button-link" href="/?settings=1">{t("settings.title")}</Link>
        <Link className="secondary button-link" href="/notifications" style={{ marginTop: 8 }}>{t("notifications.title")}</Link>
      </section>

      <section className="account-card account-card-wide">
        <span className="kicker">{t("auth.account")}</span>
        <AuthControls />
      </section>

      <SafetyCenter />
    </div>
  </PageContainer>;
}