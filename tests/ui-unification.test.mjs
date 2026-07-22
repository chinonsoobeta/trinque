import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shared application shell is mounted globally", async () => {
  const [layout, shell] = await Promise.all([
    source("app/layout.tsx"),
    source("components/AppShell.tsx"),
  ]);
  assert.match(layout, /<AppShell>/);
  assert.match(shell, /className="mobile-navigation"/);
  assert.match(shell, /t\("auth\.signIn"\)/);
  assert.match(shell, /t\("nav\.following"\)/);
});

test("discover removes fabricated social proof and invalid location fallback", async () => {
  const home = await source("app/page.tsx");
  assert.doesNotMatch(home, /12 new matches this week/);
  assert.doesNotMatch(home, /18 locals agree/);
  assert.doesNotMatch(home, /location\?\.locality \?\? "—"/);
  assert.doesNotMatch(home, /new Set\(\[2\]\)/);
  assert.match(home, /t\("home\.gather"\)/);
  assert.match(home, /t\("provenance\.seed_demo"\)/);
});

test("social feeds use the shared image-first dish card and preserve pagination contracts", async () => {
  const [feed, trending, personal] = await Promise.all([
    source("components/Feed.tsx"),
    source("app/api/feed/trending/route.ts"),
    source("app/api/feed/personal/route.ts"),
  ]);
  assert.match(feed, /SocialDishCard/);
  assert.match(trending, /nextOffset/);
  assert.match(personal, /nextCursor/);
  assert.match(trending, /imageUrl/);
  assert.match(personal, /imageUrl/);
});

test("settings no longer nests the authentication modal", async () => {
  const authControls = await source("components/AuthControls.tsx");
  assert.doesNotMatch(authControls, /AuthModal/);
});

test("group planner uses the signed-in session and has one dietary control", async () => {
  const [home, mobile] = await Promise.all([
    source("app/page.tsx"),
    source("ios/App.tsx"),
  ]);
  assert.match(home, /const \{ authenticated, authHeaders, sessionToken \} = useAuth\(\)/);
  assert.match(home, /headers: \{ \.\.\.sessionHeaders, "Content-Type": "application\/json" \}/);
  assert.match(home, /vegetarianRequired: dietaryRequirements\.includes\("vegetarian"\) \? 1 : 0/);
  assert.doesNotMatch(home, /setVegetarianRequired/);
  assert.doesNotMatch(home, /t\("group\.vegetarian"\).*inputMode="numeric"/);
  assert.match(home, /group-location-button/);
  assert.match(home, /authenticated \? t\("group\.rank"\) : t\("auth\.signIn"\)/);
  assert.doesNotMatch(home, /: t\("auth\.connecting"\)<\/button>/);
  assert.match(mobile, /canWrite=\{canWrite\} onSignIn=\{\(\) => setTab\('Profile'\)\}/);
  assert.match(mobile, /!canWrite\) \{ onSignIn\(\); return; \}/);
  assert.doesNotMatch(mobile, /group\.vegetarianCount/);
});

test("English group search uses the requested short label", async () => {
  const translations = await source("ios/i18n.ts");
  assert.match(translations, /"group\.rank": "Find"/);
  assert.doesNotMatch(translations, /"group\.rank": "Sort the picks"/);
});
