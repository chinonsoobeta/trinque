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
  assert.match(shell, />Sign in</);
  assert.match(shell, /Following/);
});

test("discover removes fabricated social proof and invalid location fallback", async () => {
  const home = await source("app/page.tsx");
  assert.doesNotMatch(home, /12 new matches this week/);
  assert.doesNotMatch(home, /18 locals agree/);
  assert.doesNotMatch(home, /location\?\.locality \?\? "—"/);
  assert.doesNotMatch(home, /new Set\(\[2\]\)/);
  assert.match(home, /For you/);
  assert.match(home, /Example tip/);
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
