"use client";

import Link from "next/link";
import { EmptyState, LoadingState, PageContainer } from "@/components/AppPrimitives";
import { NotificationList } from "@/components/NotificationList";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export default function NotificationsPage() {
  const { authenticated, loading } = useAuth();
  const t = useUiText();
  if (loading) return <PageContainer><LoadingState label={t("notifications.loading")} /></PageContainer>;
  // A lone button floating on an otherwise blank page said nothing about where
  // you were or why you were being asked.
  if (!authenticated) return <PageContainer><EmptyState eyebrow={t("nav.profile")} title={t("notifications.title")} body={t("auth.signInBody")} action={<Link className="primary button-link" href="/auth/login?next=/notifications">{t("auth.signIn")}</Link>} /></PageContainer>;
  return <PageContainer className="account-page"><header className="page-hero compact"><span className="kicker">{t("nav.profile")}</span><h1>{t("notifications.title")}</h1></header><NotificationList /></PageContainer>;
}