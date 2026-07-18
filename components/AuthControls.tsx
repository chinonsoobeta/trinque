"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Config = { configured: boolean; url?: string; publishableKey?: string };

function client(config: Config): SupabaseClient | null {
  return config.url && config.publishableKey ? createClient(config.url, config.publishableKey) : null;
}

export function AuthControls() {
  const [config, setConfig] = useState<Config | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { void fetch("/api/auth/config").then((response) => response.json()).then(setConfig).catch(() => setConfig({ configured: false })); }, []);
  if (!config) return <p className="privacy-note">Checking sign-in…</p>;
  if (!config.configured) return <p className="privacy-note">Sign-in is not configured yet. You can continue as a guest.</p>;
  const signInEmail = async () => {
    const supabase = client(config); if (!supabase || !email.trim()) return;
    setStatus("Sending sign-in link…");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setStatus(error ? "We could not send that sign-in link." : "Check your email for a secure sign-in link.");
  };
  const signInGoogle = async () => {
    const supabase = client(config); if (!supabase) return;
    setStatus("Opening Google sign-in…");
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error || !data.url) { setStatus("Google sign-in is not configured yet."); return; }
    window.location.assign(data.url);
  };
  const signOut = async () => { await client(config)?.auth.signOut(); window.localStorage.removeItem("trinque.guestToken"); window.location.assign("/"); };
  return <div className="setting-block"><span>Account</span><input aria-label="Email address" type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} /><button className="location-chip" disabled={!email.trim()} onClick={() => void signInEmail()}>Email me a sign-in link</button><button className="secondary full" onClick={() => void signInGoogle()}>Continue with Google</button><button className="text-button full" onClick={() => void signOut()}>Sign out</button>{status && <p className="location-status">{status}</p>}</div>;
}
