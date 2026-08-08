import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translations, UI_LANGUAGES } from "../ios/i18n.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const PROMPT_KEYS = ["auth.needSignInLike", "auth.needSignInSave", "auth.needSignInComment", "auth.needSignInFollow", "auth.needSignInReport"];

test("signing in does not throw away the page you were on", async () => {
  // Liking, saving, commenting, following and reporting each did a full page
  // load to /auth/login, losing the feed, the scroll position and the intent.
  for (const file of ["../components/LikeButton.tsx", "../components/SaveButton.tsx", "../components/CommentSection.tsx", "../components/FollowButton.tsx", "../components/SafetyActions.tsx"]) {
    const text = await source(file);
    assert.ok(!/location\.assign\(`\/auth\/login/.test(text), `${file} still navigates away to sign in`);
    assert.match(text, /promptSignIn\("auth\.needSignIn\w+"\)/, `${file} does not ask in place`);
  }
});

test("the shell renders the prompt over whatever asked for it", async () => {
  const shell = await source("../components/AppShell.tsx");
  assert.match(shell, /<AuthModal open=\{signInPrompt !== null\}/);
  assert.match(shell, /onAuthenticated=\{\(\) => \{ closeSignInPrompt\(\); void refresh\(\); \}\}/);
});

test("a returning user lands where they were, not in onboarding", async () => {
  const modal = await source("../components/AuthModal.tsx");
  // `?next=` was written into every sign-in link and then ignored: signing in
  // always replaced the location with /onboarding, so a returning account was
  // asked to set itself up again.
  assert.match(modal, /else if \(mode === "signup"\) window\.location\.replace\("\/onboarding"\)/);
  assert.match(modal, /else if \(onAuthenticated\) onAuthenticated\(\)/);
  assert.match(modal, /else window\.location\.replace\(loginReturnPath\(\)\)/);
});

test("each prompt says which action needs the account, in every language", async () => {
  for (const key of PROMPT_KEYS) {
    for (const language of UI_LANGUAGES) assert.ok(translations[language][key], `${key} is missing in ${language}`);
  }
});
