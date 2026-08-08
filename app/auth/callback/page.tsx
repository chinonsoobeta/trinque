"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, LoadingState, PageContainer } from "@/components/AppPrimitives";
import { getSupabaseClient } from "@/lib/auth-client";
import type { MessageKey } from "@/ios/i18n";
import { useUiText } from "@/components/useUiText";

export default function AuthCallback() {
  const t = useUiText();
  // Message keys, not translated strings. Depending on `t` re-ran this effect
  // when the language store hydrated, and the authorization code it exchanges is
  // single-use — the second run reported an expired link on a good sign-in.
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null);
  useEffect(() => { void (async () => {
    const client = await getSupabaseClient();
    if (!client) { setMessageKey("auth.notSetUp"); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) { setMessageKey("auth.linkExpired"); return; }
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { setMessageKey("auth.failed"); return; }
    const response = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const payload = await response.json() as { sessionToken?: string; error?: string };
    if (!response.ok || !payload.sessionToken) { setMessageKey("auth.failed"); return; }
    window.localStorage.setItem("trinque.sessionToken", payload.sessionToken);
    window.localStorage.setItem("trinque.guestToken", payload.sessionToken);
    window.location.replace("/onboarding");
  })(); }, []);
  // While it is working this is a wait, not a screen; only a failure needs a
  // heading, and it needs a way back rather than a dead end in serif.
  return <PageContainer className="callback-page">
    {messageKey
      ? <EmptyState eyebrow={t("nav.profile")} title={t(messageKey)} body={t("auth.signInBody")} action={<Link className="primary button-link" href="/auth/login">{t("auth.signIn")}</Link>} />
      : <LoadingState label={t("auth.callback")} />}
  </PageContainer>;
}
