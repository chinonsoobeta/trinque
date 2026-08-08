"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { googleSignInAvailable, requestPasswordReset, safeReturnPath, signInWithGoogle, signInWithPassword, signUpWithPassword, updatePassword } from "@/lib/auth-client";
import { authErrorKey, emailProblem, passwordProblem, MINIMUM_PASSWORD_LENGTH } from "@/lib/auth-errors";
import { GoogleMark, Icon } from "@/components/Icon";
import { useUiText } from "@/components/useUiText";
import type { MessageKey } from "@/ios/i18n";

export type AuthMode = "signin" | "signup" | "recovery";

type AuthModalProps = { open: boolean; onClose: () => void; initialMode?: AuthMode; embedded?: boolean; contextMessage?: string; onAuthenticated?: () => void };

export function AuthModal({ open, onClose, initialMode = "signin", embedded = false, contextMessage, onAuthenticated }: AuthModalProps) {
  const t = useUiText();
  const fieldId = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Three separate places a message can belong: under the address, under the
  // password, or above the form for anything that is about neither. One shared
  // "We could not sign you in." used to stand in for all three.
  const [emailError, setEmailError] = useState<MessageKey | null>(null);
  const [passwordError, setPasswordError] = useState<MessageKey | null>(null);
  const [statusKey, setStatusKey] = useState<MessageKey | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void googleSignInAvailable().then((available) => { if (active) setGoogleAvailable(available); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || embedded) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded, onClose, open]);

  if (!open) return null;

  function clearMessages() {
    setEmailError(null); setPasswordError(null); setStatusKey(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Checked here rather than left to the browser so the wording is ours and
    // translated, and so both fields report at once instead of one at a time.
    const emailFault = mode === "recovery" ? null : emailProblem(email);
    const passwordFault = passwordProblem(password);
    setEmailError(emailFault); setPasswordError(passwordFault); setStatusKey(null);
    if (emailFault || passwordFault) return;

    setBusy(true);
    try {
      if (mode === "recovery") {
        const { error } = await updatePassword(password);
        if (error) { setPasswordError(authErrorKey(error, mode)); return; }
        window.location.replace("/");
        return;
      }
      const result = mode === "signup" ? await signUpWithPassword(email, password) : await signInWithPassword(email, password);
      if (result.error) {
        const key = authErrorKey(result.error, mode);
        // The message belongs beside the control the person can act on.
        if (key === "auth.wrongCredentials" || key === "auth.emailNotConfirmed" || key === "auth.alreadyRegistered" || key === "auth.emailInvalid") setEmailError(key);
        else if (key === "auth.weakPassword" || key === "auth.samePassword") setPasswordError(key);
        else setStatusKey(key);
        return;
      }
      if (mode === "signup" && !result.data.session) setStatusKey("auth.checkEmail");
      // A new account goes to onboarding; an existing one goes back to whatever
      // it was doing. Signing in used to land on `/onboarding` either way, so
      // `?next=` was written into every sign-in link and then ignored, and a
      // returning user was asked to set up an account they already had.
      else if (mode === "signup") window.location.replace("/onboarding");
      else if (onAuthenticated) onAuthenticated();
      else window.location.replace(loginReturnPath());
    } catch {
      setStatusKey(mode === "signup" ? "auth.createFailed" : "auth.failed");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); clearMessages();
    try {
      const { data, error } = await signInWithGoogle(window.location.pathname === "/auth/login" ? loginReturnPath() : window.location.pathname + window.location.search);
      if (error || !data.url) setStatusKey("auth.googleFailed");
      else window.location.assign(data.url);
    } catch { setStatusKey("auth.googleFailed"); }
    finally { setBusy(false); }
  }

  async function reset() {
    const fault = emailProblem(email);
    if (fault) { setEmailError(fault); return; }
    setBusy(true); clearMessages();
    try {
      const { error } = await requestPasswordReset(email);
      if (error) setStatusKey(authErrorKey(error, "signin"));
      else setStatusKey("auth.resetSent");
    } finally { setBusy(false); }
  }

  function loginReturnPath() {
    return safeReturnPath(new URLSearchParams(window.location.search).get("next"));
  }

  const title = mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.create") : t("auth.newPassword");
  const emailErrorId = `${fieldId}-email-error`;
  const passwordErrorId = `${fieldId}-password-error`;
  return <div role="dialog" aria-modal={embedded ? undefined : true} aria-labelledby="auth-title" className={`auth-modal-backdrop${embedded ? " embedded" : ""}`} onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
    <div className="auth-modal">
      {!embedded && <button type="button" className="auth-close" onClick={onClose} aria-label={t("auth.close")}><Icon name="close" size={18} /></button>}
      <div className="auth-brand-mark" aria-hidden="true">T</div><span className="kicker">{t("auth.account")}</span><h2 id="auth-title">{title}</h2>
      <p>{contextMessage ?? t(mode === "signin" ? "auth.signInBody" : mode === "signup" ? "auth.createBody" : "auth.passwordBody")}</p>
      {mode !== "recovery" && googleAvailable && <button type="button" className="oauth-button" disabled={busy} onClick={() => void google()}><GoogleMark />{t("auth.google")}</button>}
      {mode !== "recovery" && googleAvailable && <div className="auth-divider"><span>{t("auth.useEmail")}</span></div>}
      <form onSubmit={submit} noValidate>
        {mode !== "recovery" && <label>
          <span>{t("auth.email")}</span>
          <input type="email" autoComplete="email" inputMode="email" placeholder={t("auth.email")} value={email}
            onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(null); }}
            onBlur={() => { if (email.trim()) setEmailError(emailProblem(email)); }}
            aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? emailErrorId : undefined} />
          {emailError && <small className="field-error" id={emailErrorId}>{t(emailError)}</small>}
        </label>}
        <label>
          <span>{mode === "recovery" ? t("auth.newPassword") : t("auth.password")}</span>
          <span className="password-field">
            <input type={revealed ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={MINIMUM_PASSWORD_LENGTH} placeholder={t("auth.passwordHint")} value={password}
              onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError(null); }}
              aria-invalid={passwordError ? true : undefined} aria-describedby={passwordError ? passwordErrorId : undefined} />
            <button type="button" className="password-reveal" onClick={() => setRevealed(!revealed)} aria-pressed={revealed} aria-label={t(revealed ? "auth.hidePassword" : "auth.showPassword")}><Icon name={revealed ? "eyeOff" : "eye"} size={18} /></button>
          </span>
          {passwordError && <small className="field-error" id={passwordErrorId}>{t(passwordError)}</small>}
        </label>
        <button className="primary full" disabled={busy} aria-busy={busy}>{busy ? t("auth.working") : mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.create") : t("auth.updatePassword")}</button>
      </form>
      {mode === "signin" && <button className="text-button auth-inline-action" disabled={busy} onClick={() => void reset()}>{t("auth.forgot")}</button>}
      {mode !== "recovery" && <button className="text-button auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); clearMessages(); }}>{t(mode === "signin" ? "auth.newHere" : "auth.haveAccount")}</button>}
      {statusKey && <p role="status" aria-live="polite" className="auth-status">{t(statusKey)}</p>}
      {/* The sign-in page says this above the card already; only the modal,
          which arrives over another screen with no such preamble, needs it. */}
      {!embedded && <small className="auth-footnote">{t("auth.signInHelp")}</small>}
    </div>
  </div>;
}
