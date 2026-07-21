"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestPasswordReset, safeReturnPath, signInWithGoogle, signInWithPassword, signUpWithPassword, updatePassword } from "@/lib/auth-client";

export type AuthMode = "signin" | "signup" | "recovery";

type AuthModalProps = { open: boolean; onClose: () => void; initialMode?: AuthMode; embedded?: boolean; contextMessage?: string };

export function AuthModal({ open, onClose, initialMode = "signin", embedded = false, contextMessage }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || embedded) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded, onClose, open]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || (mode !== "recovery" && !email.trim())) return;
    setBusy(true); setStatus("");
    try {
      if (mode === "recovery") {
        const { error } = await updatePassword(password);
        if (error) { setStatus(error.message); return; }
        window.location.replace("/");
        return;
      }
      const result = mode === "signup" ? await signUpWithPassword(email, password) : await signInWithPassword(email, password);
      if (result.error) { setStatus(result.error.message); return; }
      if (mode === "signup" && !result.data.session) setStatus("Check your email, then sign in.");
      else if (window.location.pathname === "/auth/login") window.location.replace(loginReturnPath());
      else onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setStatus("");
    try {
      const { data, error } = await signInWithGoogle(window.location.pathname === "/auth/login" ? loginReturnPath() : window.location.pathname + window.location.search);
      if (error || !data.url) setStatus(error?.message ?? "Google sign-in is not available.");
      else window.location.assign(data.url);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!email.trim()) { setStatus("Enter your email first."); return; }
    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email);
      setStatus(error ? error.message : "We sent password reset steps.");
    } finally { setBusy(false); }
  }

  function loginReturnPath() {
    return safeReturnPath(new URLSearchParams(window.location.search).get("next"));
  }

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Make a Trinque account" : "Choose a new password";
  return <div role="dialog" aria-modal={embedded ? undefined : true} aria-labelledby="auth-title" className={`auth-modal-backdrop${embedded ? " embedded" : ""}`} onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
    <div className="auth-modal">
      {!embedded && <button type="button" className="auth-close" onClick={onClose} aria-label="Close authentication dialog">×</button>}
      <div className="auth-brand-mark" aria-hidden="true">T</div><span className="kicker">Trinque account</span><h2 id="auth-title">{title}</h2>
      <p>{contextMessage ?? (mode === "signin" ? "Sign in to save, post, follow, like, comment, and plan meals." : mode === "signup" ? "Make an account to save dishes and connect with people." : "Enter a new password for your Trinque account.")}</p>
      {mode !== "recovery" && <button type="button" className="oauth-button" disabled={busy} onClick={() => void google()}><span aria-hidden="true">G</span>Continue with Google</button>}
      {mode !== "recovery" && <div className="auth-divider"><span>or use email</span></div>}
      <form onSubmit={submit}>
        {mode !== "recovery" && <label><span>Email</span><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        <label><span>{mode === "recovery" ? "New password" : "Password"}</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary full" disabled={busy} aria-busy={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Update password"}</button>
      </form>
      {mode === "signin" && <button className="text-button auth-inline-action" disabled={busy} onClick={() => void reset()}>Forgot password?</button>}
      {mode !== "recovery" && <button className="text-button auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStatus(""); }}>{mode === "signin" ? "New to Trinque? Create an account" : "Already have an account? Sign in"}</button>}
      {status && <p role="status" aria-live="polite" className="auth-status">{status}</p>}
      <small className="auth-footnote">Anyone can browse. Trinque asks you to sign in only when an action needs your account.</small>
    </div>
  </div>;
}
