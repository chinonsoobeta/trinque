"use client";

import Link from "next/link";
import { Feed } from "@/components/Feed";
import { Icon } from "@/components/Icon";
import { PageContainer } from "@/components/AppPrimitives";
import { usePreferences } from "@/components/PreferencesProvider";
import { useUiText } from "@/components/useUiText";

/**
 * Discover. This route used to be four screens in one component, switched by
 * `?view=` through custom window events; each of those screens is now a real
 * route and this one only renders the feed.
 */
export default function DiscoverPage() {
  const t = useUiText();
  const { location } = usePreferences();

  return <PageContainer className="discover-page">
    <header className="page-hero compact">
      <span className="kicker">{t("home.eyebrow")}</span>
      <h1>{t("home.title")}</h1>
      <p>{t("home.body")}</p>
      <div className="discover-actions">
        <Link className="compact-location" href="/settings"><Icon name="location" size={16} />{location?.locality ?? t("location.change")}</Link>
        <Link className="primary button-link" href="/post"><Icon name="post" size={16} />{t("home.analyze")}</Link>
        <Link className="text-button" href="/post">{t("home.demo")}</Link>
      </div>
    </header>
    <Feed type="trending" />
  </PageContainer>;
}
