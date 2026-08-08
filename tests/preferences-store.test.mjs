import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

/**
 * A store, not a DOM event. Language used to live in two places at once — React
 * state inside the provider and `localStorage` read directly by `useUiLanguage`
 * — kept roughly in step by a `trinque:language` event. They could disagree.
 */
test("language has one home that both the provider and the translator read", async () => {
  const provider = await source("../components/PreferencesProvider.tsx");
  const text = await source("../components/useUiText.ts");
  for (const [name, file] of [["PreferencesProvider.tsx", provider], ["useUiText.ts", text]]) {
    assert.ok(file.includes('from "@/lib/preferences-store"'), `${name} does not read the store`);
    assert.ok(!file.includes("trinque:language"), `${name} still uses the language event`);
    assert.ok(!file.includes("dispatchEvent"), `${name} still announces changes by DOM event`);
  }
  assert.match(text, /useSyncExternalStore\(subscribe, \(\) => getSnapshot\(\)\.language, \(\) => getServerSnapshot\(\)\.language\)/);
});

test("the store's server snapshot is a stable object", async () => {
  // `useSyncExternalStore` compares snapshots by identity; returning a fresh
  // object from `getServerSnapshot` makes React re-render without end.
  const store = await source("../lib/preferences-store.ts");
  assert.match(store, /const SERVER: PreferencesSnapshot = \{/);
  assert.match(store, /export function getServerSnapshot\(\): PreferencesSnapshot \{\n\s*return SERVER;/);
});

test("stored preferences are read on first use, not on a timer", async () => {
  // The restore used to be deferred with `setTimeout(…, 0)`, so it could land
  // after the `/api/preferences` response and overwrite the server's answer
  // with a stale local copy.
  const store = await source("../lib/preferences-store.ts");
  assert.match(store, /if \(!hydrated\) \{ hydrated = true; snapshot = readStored\(\); \}/);
  assert.ok(!store.includes("setTimeout"), "the restore is still deferred");
});

test("only a coarse area is ever written to storage", async () => {
  const store = await source("../lib/preferences-store.ts");
  assert.match(store, /JSON\.stringify\(coarseLocation\(location\)\)/);
});

test("a signed-out visitor is not asked for server preferences", async () => {
  const provider = await source("../components/PreferencesProvider.tsx");
  assert.match(provider, /if \(!sessionToken\) return;/);
});

test("a second tab follows the same change", async () => {
  const store = await source("../lib/preferences-store.ts");
  assert.match(store, /window\.addEventListener\("storage", onStorage\)/);
  assert.match(store, /window\.removeEventListener\("storage", onStorage\)/);
});
