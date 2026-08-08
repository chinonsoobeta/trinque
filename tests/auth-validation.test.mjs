import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authErrorKey, emailProblem, passwordProblem } from "../lib/auth-errors.ts";
import { translations, UI_LANGUAGES } from "../ios/i18n.ts";

test("a failure names the thing the person can fix", () => {
  // Every one of these used to read "We could not sign you in.", which is a true
  // statement about four problems with four different next steps.
  assert.equal(authErrorKey({ code: "invalid_credentials" }, "signin"), "auth.wrongCredentials");
  assert.equal(authErrorKey({ message: "Invalid login credentials" }, "signin"), "auth.wrongCredentials");
  assert.equal(authErrorKey({ code: "email_not_confirmed" }, "signin"), "auth.emailNotConfirmed");
  assert.equal(authErrorKey({ message: "User already registered" }, "signup"), "auth.alreadyRegistered");
  assert.equal(authErrorKey({ code: "weak_password" }, "signup"), "auth.weakPassword");
  assert.equal(authErrorKey({ code: "same_password" }, "recovery"), "auth.samePassword");
  assert.equal(authErrorKey({ status: 429 }, "signin"), "auth.rateLimited");
});

test("an unrecognised failure still says which thing did not happen", () => {
  assert.equal(authErrorKey({ code: "wat" }, "signin"), "auth.failed");
  assert.equal(authErrorKey({ code: "wat" }, "signup"), "auth.createFailed");
  assert.equal(authErrorKey(null, "signup"), "auth.createFailed");
});

test("field checks distinguish empty from malformed", () => {
  assert.equal(emailProblem(""), "auth.emailRequired");
  assert.equal(emailProblem("   "), "auth.emailRequired");
  assert.equal(emailProblem("nope"), "auth.emailInvalid");
  assert.equal(emailProblem("a@b"), "auth.emailInvalid");
  assert.equal(emailProblem("someone@example.com"), null);
  // Addresses that look odd but are deliverable must pass: the confirmation
  // email is the real check, and a stricter pattern here would lock people out.
  assert.equal(emailProblem("first+tag@sub.example.co.uk"), null);
  assert.equal(passwordProblem(""), "auth.passwordRequired");
  assert.equal(passwordProblem("shorty"), "auth.passwordTooShort");
  assert.equal(passwordProblem("longenough"), null);
});

test("every message a failure can produce is translated", () => {
  const keys = ["auth.wrongCredentials", "auth.emailNotConfirmed", "auth.alreadyRegistered", "auth.weakPassword", "auth.samePassword", "auth.rateLimited", "auth.emailRequired", "auth.emailInvalid", "auth.passwordRequired", "auth.passwordTooShort", "auth.showPassword", "auth.hidePassword"];
  for (const key of keys) for (const language of UI_LANGUAGES) assert.ok(translations[language][key], `${key} is missing in ${language}`);
});

test("the form validates itself rather than deferring to the browser", async () => {
  const source = await readFile(new URL("../components/AuthModal.tsx", import.meta.url), "utf8");
  // `noValidate` is what lets our own translated messages appear at all; without
  // it the browser reports first, in its own language, one field at a time.
  assert.match(source, /<form onSubmit=\{submit\} noValidate>/);
  assert.match(source, /aria-invalid=\{emailError \? true : undefined\}/);
  assert.match(source, /aria-describedby=\{passwordError \? passwordErrorId : undefined\}/);
  assert.match(source, /className="password-reveal"/);
  assert.doesNotMatch(source, /setStatus\(t\("auth\.failed"\)\)/);
});
