import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translations, UI_LANGUAGES } from "../ios/i18n.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("explore has something to type into", async () => {
  const page = await source("../app/explore/page.tsx");
  // Explore offered trending and following but no search, so reaching a
  // particular dish or person meant already knowing the URL.
  assert.match(page, /<SearchResults query=\{query\} \/>/);
  assert.match(page, /role="search"/);
  // Enter searches: implicit form submission did not fire from this field.
  assert.match(page, /if \(event\.key === "Enter"\) \{ event\.preventDefault\(\); go\(\{ q: draft\.trim\(\) \}\); \}/);
});

test("the query lives in the URL so a search can be shared and gone back to", async () => {
  const page = await source("../app/explore/page.tsx");
  assert.match(page, /const query = \(params\.get\("q"\) \?\? ""\)\.trim\(\)/);
  assert.match(page, /router\.replace\(search \? `\/explore\?\$\{search\}` : "\/explore"/);
  // The field follows the URL without an effect painting the stale text first.
  assert.match(page, /if \(shownQuery !== query\) \{ setShownQuery\(query\); setDraft\(query\); \}/);
});

test("search results carry their own like and save state", async () => {
  const route = await source("../app/api/search/route.ts");
  // Twenty result cards must not each ask the server whether the viewer liked
  // them — the same reason the feeds fold this in.
  assert.match(route, /engagementColumns\(viewerId\)/);
  assert.match(route, /withViewerState\(dish\)/);
});

test("a query is matched as text, not as a pattern", async () => {
  const route = await source("../app/api/search/route.ts");
  // Searching "100%" must look for that text rather than matching every row.
  assert.match(route, /replace\(\/\[\\\\%_\]\/g/);
  assert.match(route, /ESCAPE/);
});

test("exact matches lead the results", async () => {
  const route = await source("../app/api/search/route.ts");
  assert.match(route, /CASE WHEN LOWER\(\$\{publishedDishes\.name\}\) = \$\{query\}/);
  assert.match(route, /CASE WHEN LOWER\(\$\{profiles\.handle\}\) = \$\{query\}/);
});

test("only active dishes are searchable", async () => {
  const route = await source("../app/api/search/route.ts");
  assert.match(route, /eq\(publishedDishes\.moderationStatus, "active"\)/);
});

test("search copy exists in every language", async () => {
  for (const key of ["search.label", "search.placeholder", "search.action", "search.clear", "search.searching", "search.found", "search.noResults", "search.noResultsHelp", "search.failed"]) {
    for (const language of UI_LANGUAGES) assert.ok(translations[language][key], `${key} is missing in ${language}`);
  }
});

test("the result count does not need plural agreement in eight languages", async () => {
  // "1 dishes and 0 people" was the first attempt.
  for (const language of UI_LANGUAGES) assert.ok(!/\{dishes\}|\{people\}/.test(translations[language]["search.found"]), `${language} still counts`);
});
