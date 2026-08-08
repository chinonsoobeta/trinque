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

/**
 * Consistency is a usability property: a shape learned on one card has to hold
 * on the next. Both signature shapes were written out by hand at every site and
 * had drifted — 28/8 on a dish card, 26/8 on a taste card, 34/8 on the skeleton
 * standing in for the dish card, 24/8 on the auth modal; 26/0 and 25/0 on
 * sheets. They are tokens now, and no site may go back to spelling them out.
 */
test("the two card shapes come from tokens, not from hand-written corners", () => {
  const handwritten = [...css.matchAll(/border-radius:[^;}]*\b(2[4-9]|3[0-9])px\b[^;}]*/g)]
    .map((match) => match[0].trim())
    // A single uniform corner is not the signature shape — only the
    // multi-value forms are, and those are what drifted.
    .filter((rule) => rule.split(/\s+/).length > 2);
  assert.deepEqual(handwritten, []);
  assert.ok(css.includes("var(--radius-card)"), "the card shape token is unused");
  assert.ok(css.includes("var(--radius-sheet)"), "the sheet shape token is unused");
});

test("buttons use one weight scale", () => {
  // 750, 850 and 900 had crept in beside 700 and 800, so the same emphasis
  // came out a shade heavier depending on which rule you landed in.
  const weights = new Set([...css.matchAll(/font-weight:\s*(\d{3})/g)].map((match) => match[1]));
  for (const value of [...css.matchAll(/font:\s*(\d{3})\s/g)].map((match) => match[1])) weights.add(value);
  assert.deepEqual([...weights].sort(), ["400", "500", "600", "700", "800"]);
});

test("the one tab strip in the app is the shared control", async () => {
  const explore = await readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8");
  // Explore hand-rolled its own: 39px tall, no roving tabindex, no arrow keys.
  assert.match(explore, /<Tabs label=/);
  assert.ok(!explore.includes('className="filters"'), "the legacy tab strip is back");
  assert.ok(!css.includes(".filters"), "the legacy tab strip rules are back");
});

test("an irreversible action does not look like an ordinary one", async () => {
  assert.match(css, /\.text-button\.danger \{ color: var\(--danger-text\); \}/);
  const destructive = [
    ["../components/DishOwnerControls.tsx", "privacy.deleteDish"],
    ["../components/CommentSection.tsx", "safety.removeComment"],
    ["../components/SafetyActions.tsx", "safety.blockUser"],
    ["../components/AccountPrivacyActions.tsx", "privacy.delete"],
    ["../components/PrivacySettings.tsx", "privacy.delete"],
  ];
  for (const [file, key] of destructive) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    // The button carrying the key has to be the danger variant. Muting,
    // signing out and removing a photo are reversible and stay accent-coloured.
    const button = source.split(`{t("${key}")}`)[0].lastIndexOf('className="text-button');
    assert.ok(button >= 0, `${file}: ${key} is no longer a text button`);
    assert.match(source.slice(button, button + 40), /text-button danger/, `${file}: ${key} is not marked destructive`);
  }
});

/**
 * Contrast measured in the browser at 1280, both themes, all twelve routes.
 * The status colours are chosen to read as a band of colour, and were being
 * used as 10px text on their own 10% tint: the cuisine chip came out at
 * 4.38:1 in the light theme. The -text variants mix toward the page's own
 * text colour, which darkens them in light and lightens them in dark.
 */
test("a status colour is never used raw as text", () => {
  const raw = [...css.matchAll(/(?<!-)color:\s*var\(--(success|warning|danger)\)/g)].map((match) => match[0]);
  assert.deepEqual(raw, []);
  for (const tone of ["success", "warning", "danger"]) {
    assert.ok(css.includes(`var(--${tone}-text)`), `--${tone}-text is unused`);
  }
});

test("every empty state is the shared one", async () => {
  const notifications = await readFile(new URL("../components/NotificationList.tsx", import.meta.url), "utf8");
  assert.match(notifications, /<EmptyState title=\{t\("notifications\.empty"\)\}/);
  // The dashed box the notification list used to draw for itself.
  assert.ok(!css.includes(".empty-state{"), "the legacy empty-state rules are back");
});

/**
 * The pairing is Fraunces for display and Inter for UI. Fraunces carries an
 * optical-size axis, which is what lets one file serve the 88px hero and a
 * 20px card title; below about 15px it is the wrong tool and Inter's larger
 * x-height is what keeps the app's many 10-13px labels readable. The taste
 * tags were the one pill set in italic Fraunces at 13px.
 */
test("the display face is not asked to do the UI face's job", () => {
  const small = [...css.matchAll(/font:[^;}]*?\b(\d|1[0-4])px[^;}]*var\(--font-display\)/g)].map((match) => match[0].trim());
  assert.deepEqual(small, []);
});

test("a count does not shift its neighbours as it ticks", () => {
  // Proportional figures re-flow the action row the moment a like lands.
  assert.match(css, /\.social-dish-actions, \.profile-stats b \{ font-variant-numeric: tabular-nums; \}/);
});

test("a screen that turns you away still says where you are and where to go", async () => {
  const moderation = await readFile(new URL("../app/moderation/page.tsx", import.meta.url), "utf8");
  const notifications = await readFile(new URL("../app/notifications/page.tsx", import.meta.url), "utf8");
  // Both were a bare sentence or a lone button on an otherwise blank page.
  assert.match(moderation, /moderation\.denied.*action=\{<Link/s);
  assert.match(notifications, /!authenticated\) return <PageContainer><EmptyState/);
});
