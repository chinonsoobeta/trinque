"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  useEffect(() => { void (async () => {
    const config = await fetch("/api/auth/config").then((response) => response.json()) as { configured: boolean; url?: string; publishableKey?: string };
    if (!config.configured || !config.url || !config.publishableKey) { setMessage("Sign-in is not configured."); return; }
    const supabase = createClient(config.url, config.publishableKey);
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) { const { error } = await supabase.auth.exchangeCodeForSession(code); if (error) { setMessage("That sign-in link is invalid or expired."); return; } }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setMessage("We could not complete sign-in."); return; }
    const response = await fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const payload = await response.json() as { guestToken?: string; identity?: { displayName?: string } };
    if (!response.ok || !payload.guestToken) { setMessage("We could not create your Trinque session."); return; }
    window.localStorage.setItem("trinque.guestToken", payload.guestToken);
    window.location.replace("/");
  })(); }, []);
  return <main style={{ padding: "3rem", fontFamily: "serif" }}><h1>Trinque</h1><p>{message}</p></main>;
}
