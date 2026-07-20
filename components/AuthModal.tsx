"use client";

import { FormEvent, useState } from "react";
import { requestPasswordReset, safeReturnPath, signInWithGoogle, signInWithPassword, signUpWithPassword, updatePassword } from "@/lib/auth-client";

export type AuthMode = "signin" | "signup" | "recovery";

export function AuthModal({ open, onClose, initialMode = "signin" }: { open: boolean; onClose: () => void; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
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
      if (mode === "signup" && !result.data.session) setStatus("Check your email to verify your account, then sign in.");
      else if (window.location.pathname === "/auth/login") window.location.replace(loginReturnPath());
      else onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setStatus("");
    try {
      const { data, error } = await signInWithGoogle(window.location.pathname === "/auth/login" ? loginReturnPath() : window.location.pathname + window.location.search);
      if (error || !data.url) setStatus(error?.message ?? "Google sign-in is unavailable.");
      else window.location.assign(data.url);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!email.trim()) { setStatus("Enter your email first."); return; }
    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email);
      setStatus(error ? error.message : "Password reset instructions sent.");
    } finally { setBusy(false); }
  }

  function loginReturnPath() {
    return safeReturnPath(new URLSearchParams(window.location.search).get("next"));
  }

  return <div role="dialog" aria-modal="true" aria-label={mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"} className="auth-modal-backdrop">
    <div className="auth-modal">
      <button type="button" className="text-button" onClick={onClose} aria-label="Close authentication dialog">×</button>
      <h2>{mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your Trinque account" : "Choose a new password"}</h2>
      <p>{mode === "signin" ? "Sign in to save, publish, follow, like, comment, and manage groups." : mode === "signup" ? "Create an account to join Trinque’s social features." : "Enter a new password for your Trinque account."}</p>
      <form onSubmit={submit}>
        {mode !== "recovery" && <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary full" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Update password"}</button>
      </form>
      {mode !== "recovery" && <button className="secondary full" disabled={busy} onClick={() => void google()}>Continue with Google</button>}
      {mode === "signin" && <button className="text-button full" disabled={busy} onClick={() => void reset()}>Forgot password?</button>}
      <button className="text-button full" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStatus(""); }}>{mode === "signin" ? "Need an account? Sign up" : "Back to sign in"}</button>
      {status && <p role="status" className="location-status">{status}</p>}
    </div>
  </div>;
}
