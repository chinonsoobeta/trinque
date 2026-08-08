import type { MessageKey } from "../ios/i18n.ts";

/**
 * Turns a sign-in failure into the message that tells the person what to do
 * about it.
 *
 * Every failure used to read "We could not sign you in.", which is true of a
 * mistyped password, an unconfirmed address and an account that already exists —
 * three problems with three different next steps.
 */
export function authErrorKey(error: { code?: string; message?: string; status?: number } | null | undefined, mode: "signin" | "signup" | "recovery"): MessageKey {
  if (!error) return mode === "signup" ? "auth.createFailed" : "auth.failed";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  const says = (...needles: string[]) => needles.some((needle) => code === needle || message.includes(needle));

  if (says("invalid_credentials", "invalid login credentials")) return "auth.wrongCredentials";
  if (says("email_not_confirmed", "email not confirmed")) return "auth.emailNotConfirmed";
  if (says("user_already_exists", "user_already_registered", "already registered", "already been registered")) return "auth.alreadyRegistered";
  if (says("weak_password", "password should be", "password is too weak")) return "auth.weakPassword";
  if (says("same_password", "should be different from the old password")) return "auth.samePassword";
  if (says("over_request_rate_limit", "over_email_send_rate_limit", "rate limit", "too many requests")) return "auth.rateLimited";
  if (says("email_address_invalid", "validation_failed", "unable to validate email")) return "auth.emailInvalid";
  if (error.status === 429) return "auth.rateLimited";
  return mode === "signup" ? "auth.createFailed" : "auth.failed";
}

/**
 * Deliberately permissive: the authoritative check is the confirmation email, so
 * this only catches the shapes that cannot be an address at all — a browser's
 * own `type="email"` check rejects addresses that are in fact deliverable.
 */
export function emailProblem(email: string): MessageKey | null {
  const value = email.trim();
  if (!value) return "auth.emailRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "auth.emailInvalid";
  return null;
}

export const MINIMUM_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): MessageKey | null {
  if (!password) return "auth.passwordRequired";
  if (password.length < MINIMUM_PASSWORD_LENGTH) return "auth.passwordTooShort";
  return null;
}
