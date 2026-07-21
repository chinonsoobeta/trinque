"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/auth-client";
import { useUiText } from "@/components/useUiText";

export default function AuthCallback() {
  const t = useUiText();
  const [message, setMessage] = useState("");
  useEffect(() => { void (async () => {
    const client = await getSupabaseClient();
    if (!client) { setMessage(t("auth.notSetUp")); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) { setMessage(t("auth.linkExpired")); return; }
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { setMessage(t("auth.failed")); return; }
    const response = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const payload = await response.json() as { sessionToken?: string; error?: string };
    if (!response.ok || !payload.sessionToken) { setMessage(t("auth.failed")); return; }
    window.localStorage.setItem("trinque.sessionToken", payload.sessionToken);
    window.localStorage.setItem("trinque.guestToken", payload.sessionToken);
    window.location.replace("/onboarding");
  })(); }, [t]);
  return <main style={{ padding: "3rem", fontFamily: "serif" }}><h1>Trinque</h1><p>{message || t("auth.callback")}</p></main>;
}
