import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translations, UI_LANGUAGES } from "../ios/i18n.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("onboarding asks four short questions instead of one long form", async () => {
  const page = await source("../app/onboarding/page.tsx");
  assert.match(page, /const STEPS: Step\[\] = \["identity", "region", "taste", "photo"\];/);
  // The two that ask for things the account works without can be passed over.
  assert.match(page, /const OPTIONAL: Step\[\] = \["taste", "photo"\];/);
  assert.match(page, /aria-current=\{position === index \? "step" : undefined\}/);
});

test("each step reports what it asked for, not one message for the whole form", async () => {
  const page = await source("../app/onboarding/page.tsx");
  for (const key of ["onboarding.nameRequired", "onboarding.usernameRequired", "onboarding.usernameInvalid", "onboarding.usernameTaken", "onboarding.countryRequired", "onboarding.languageRequired"]) {
    assert.ok(page.includes(`"${key}"`), `${key} is never shown`);
  }
  // "Finish your profile first." used to stand for all six.
  assert.doesNotMatch(page, /setStatus\(t\("publish\.requirements"\)\)/);
});

test("a taken username is reported while typing and again on save", async () => {
  const page = await source("../app/onboarding/page.tsx");
  // The check that runs as the field is typed in…
  assert.match(page, /const checkHandle = useCallback\(async \(value: string\)/);
  assert.match(page, /setHandleState\(response\.status === 404 \? "free" : "taken"\)/);
  // …and the one that catches the race where someone else took it in between.
  assert.match(page, /payload\?\.error === "username_taken"/);
});

test("skipping ahead cannot post a half-filled profile", async () => {
  const page = await source("../app/onboarding/page.tsx");
  assert.match(page, /const found = \{ \.\.\.problemsFor\("identity"\), \.\.\.problemsFor\("region"\) \};/);
  assert.match(page, /setStep\(found\.name \|\| found\.handle \? "identity" : "region"\);/);
});

test("the avatar is cropped to what the circle shows", async () => {
  const cropper = await source("../components/AvatarCropper.tsx");
  assert.match(cropper, /const OUTPUT_SIZE = 512;/);
  // Screen measurements are multiplied by one ratio to reach file coordinates;
  // if that is dropped the upload no longer matches the preview.
  assert.match(cropper, /const ratio = OUTPUT_SIZE \/ FRAME_SIZE;/);
  // An abandoned load must not report a problem: revoking its object URL fires
  // `onerror`, which once rejected a perfectly good PNG.
  assert.match(cropper, /element\.onerror = \(\) => \{ if \(active\) onProblem/);
  assert.match(cropper, /return \(\) => \{ active = false; URL\.revokeObjectURL\(url\); \};/);
  // Panning has to work without a pointer.
  assert.match(cropper, /function onKeyDown\(event: React\.KeyboardEvent\)/);
});

test("every step's copy exists in every language", async () => {
  const keys = ["onboarding.step", "onboarding.stepIdentity", "onboarding.stepRegion", "onboarding.stepTaste", "onboarding.stepPhoto", "onboarding.next", "onboarding.back", "onboarding.skip", "onboarding.finish", "onboarding.cropHelp", "onboarding.usernameFree"];
  for (const key of keys) for (const language of UI_LANGUAGES) assert.ok(translations[language][key], `${key} is missing in ${language}`);
});
