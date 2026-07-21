"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/auth-client";

export default function AuthCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  useEffect(() => { void (async () => {
    const client = await getSupabaseClient();
    if (!client) { setMessage("Sign-in is not configured."); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) { setMessage("That sign-in link is invalid or expired."); return; }
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { setMessage("We could not complete sign-in."); return; }
    const response = await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const payload = await response.json() as { sessionToken?: string; error?: string };
    if (!response.ok || !payload.sessionToken) { setMessage(payload.error ?? "We could not create your Trinque session."); return; }
    window.localStorage.setItem("trinque.sessionToken", payload.sessionToken);
    window.localStorage.setItem("trinque.guestToken", payload.sessionToken);
    window.location.replace("/onboarding");
  })(); }, []);
  return <main style={{ padding: "3rem", fontFamily: "serif" }}><h1>Trinque</h1><p>{message}</p></main>;
}
