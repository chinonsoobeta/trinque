"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestPasswordReset, safeReturnPath, signInWithGoogle, signInWithPassword, signUpWithPassword, updatePassword } from "@/lib/auth-client";
import { useUiText } from "@/components/useUiText";

export type AuthMode = "signin" | "signup" | "recovery";

type AuthModalProps = { open: boolean; onClose: () => void; initialMode?: AuthMode; embedded?: boolean; contextMessage?: string };

export function AuthModal({ open, onClose, initialMode = "signin", embedded = false, contextMessage }: AuthModalProps) {
  const t = useUiText();
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
        if (error) { setStatus(t("auth.failed")); return; }
        window.location.replace("/");
        return;
      }
      const result = mode === "signup" ? await signUpWithPassword(email, password) : await signInWithPassword(email, password);
      if (result.error) { setStatus(t("auth.failed")); return; }
      if (mode === "signup" && !result.data.session) setStatus(t("auth.checkEmail"));
      else window.location.replace("/onboarding");
    } catch {
      setStatus(t("auth.failed"));
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setStatus("");
    try {
      const { data, error } = await signInWithGoogle(window.location.pathname === "/auth/login" ? loginReturnPath() : window.location.pathname + window.location.search);
      if (error || !data.url) setStatus(t("auth.googleFailed"));
      else window.location.assign(data.url);
    } catch { setStatus(t("auth.googleFailed")); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!email.trim()) { setStatus(t("auth.enterEmail")); return; }
    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email);
      setStatus(error ? t("error.generic") : t("auth.resetSent"));
    } finally { setBusy(false); }
  }

  function loginReturnPath() {
    return safeReturnPath(new URLSearchParams(window.location.search).get("next"));
  }

  const title = mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.create") : t("auth.newPassword");
  return <div role="dialog" aria-modal={embedded ? undefined : true} aria-labelledby="auth-title" className={`auth-modal-backdrop${embedded ? " embedded" : ""}`} onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
    <div className="auth-modal">
      {!embedded && <button type="button" className="auth-close" onClick={onClose} aria-label={t("auth.close")}>×</button>}
      <div className="auth-brand-mark" aria-hidden="true">T</div><span className="kicker">{t("auth.account")}</span><h2 id="auth-title">{title}</h2>
      <p>{contextMessage ?? t(mode === "signin" ? "auth.signInBody" : mode === "signup" ? "auth.createBody" : "auth.passwordBody")}</p>
      {mode !== "recovery" && <button type="button" className="oauth-button" disabled={busy} onClick={() => void google()}><span aria-hidden="true">G</span>{t("auth.google")}</button>}
      {mode !== "recovery" && <div className="auth-divider"><span>{t("auth.useEmail")}</span></div>}
      <form onSubmit={submit}>
        {mode !== "recovery" && <label><span>{t("auth.email")}</span><input type="email" autoComplete="email" inputMode="email" placeholder={t("auth.email")} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        <label><span>{mode === "recovery" ? t("auth.newPassword") : t("auth.password")}</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder={t("auth.passwordHint")} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary full" disabled={busy} aria-busy={busy}>{busy ? t("auth.working") : mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.create") : t("auth.updatePassword")}</button>
      </form>
      {mode === "signin" && <button className="text-button auth-inline-action" disabled={busy} onClick={() => void reset()}>{t("auth.forgot")}</button>}
      {mode !== "recovery" && <button className="text-button auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStatus(""); }}>{t(mode === "signin" ? "auth.newHere" : "auth.haveAccount")}</button>}
      {status && <p role="status" aria-live="polite" className="auth-status">{status}</p>}
      <small className="auth-footnote">{t("auth.signInHelp")}</small>
    </div>
  </div>;
}
