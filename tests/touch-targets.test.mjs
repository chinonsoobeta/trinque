import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/components.css", import.meta.url), "utf8");

/**
 * The quality bar is a 44px minimum. Everything below sat between 36 and 43 —
 * close enough to look deliberate and consistently too small to hit. Measured
 * in the browser at 375 and 1280 across every route; pinned here so the next
 * hand-written rule does not quietly drop back to 40.
 */
test("no control declares a height under 44px", () => {
  // One entry per rule that was measured too small in the browser. A blanket
  // scan of every `height:` in the file cannot tell a button from an avatar,
  // so the rules are named: each of these was a real target under the bar.
  const controls = [
    ".app-brand", ".app-nav-link", ".app-create-action", ".signin-link",
    ".notification-bell > button, .profile-menu-trigger", ".compact-action",
    ".comment-link, .details-link", ".social-contributor", ".auth-close",
    ".password-reveal", ".btn-small", ".group-location-button", ".confirmation",
  ];
  const offenders = [];
  for (const selector of controls) {
    const start = css.indexOf(selector + " {") >= 0 ? css.indexOf(selector + " {") : css.indexOf(selector + "{");
    assert.ok(start >= 0, `${selector} is gone — update this list rather than deleting the check`);
    const block = css.slice(start, css.indexOf("}", start));
    const size = /min-height:\s*(\d+)px/.exec(block) ?? /height:\s*(\d+)px/.exec(block);
    if (!size || Number(size[1]) < 44) offenders.push(`${selector} → ${size ? size[1] + "px" : "no height"}`);
  }
  assert.deepEqual(offenders, []);
});

test("a link that looks like a button lays out like one", () => {
  // `min-height` does nothing to an inline anchor: "Change plan" rendered 19px
  // tall while claiming the same class as a 48px button.
  assert.match(css, /\.primary, \.secondary \{ display: inline-flex;/);
});

test("the settings sections are headings, not spans that look like them", async () => {
  const settings = await readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
  for (const key of ["settings.language", "settings.theme", "settings.measurement", "settings.location"]) {
    assert.match(settings, new RegExp(`<h2>\\{t\\("${key.replace(".", "\\.")}"\\)\\}</h2>`), `${key} is not a heading`);
  }
  const privacy = await readFile(new URL("../components/PrivacySettings.tsx", import.meta.url), "utf8");
  assert.match(privacy, /<h2>\{t\("privacy\.title"\)\}<\/h2>/);
});

test("a screen that turns you away still says where you are and where to go", async () => {
  const moderation = await readFile(new URL("../app/moderation/page.tsx", import.meta.url), "utf8");
  const notifications = await readFile(new URL("../app/notifications/page.tsx", import.meta.url), "utf8");
  // Both were a bare sentence or a lone button on an otherwise blank page.
  assert.match(moderation, /moderation\.denied.*action=\{<Link/s);
  assert.match(notifications, /!authenticated\) return <PageContainer><EmptyState/);
});
