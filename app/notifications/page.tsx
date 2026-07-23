"use client";

import Link from "next/link";
import { PageContainer } from "@/components/AppPrimitives";
import { NotificationList } from "@/components/NotificationList";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export default function NotificationsPage() {
  const { authenticated, loading } = useAuth();
  const t = useUiText();
  if (loading) return <PageContainer><p>{t("notifications.loading")}</p></PageContainer>;
  if (!authenticated) return <PageContainer><Link className="secondary button-link" href="/auth/login?next=/notifications">{t("auth.signIn")}</Link></PageContainer>;
  return <PageContainer className="account-page"><header className="page-hero compact"><span className="kicker">{t("nav.profile")}</span><h1>{t("notifications.title")}</h1></header><NotificationList /></PageContainer>;
}