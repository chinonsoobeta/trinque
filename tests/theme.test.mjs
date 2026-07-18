import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web applies system, light and dark themes before meaningful render", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /trinque\.theme/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(layout, /dataset\.theme/);
  assert.match(css, /\[data-theme="dark"\]/);
  for (const token of ["--bg", "--surface", "--text", "--muted", "--border", "--burgundy", "--terracotta", "--success", "--warning", "--danger"]) assert.match(css, new RegExp(token));
  assert.doesNotMatch(css, /filter:\s*invert/i);
});

test("iOS follows Appearance and provides semantic dark tokens", async () => {
  const source = await readFile(new URL("../ios/App.tsx", import.meta.url), "utf8");
  assert.match(source, /DynamicColorIOS/);
  for (const token of ["burgundy", "terracotta", "success", "warning", "danger"]) assert.match(source, new RegExp(`${token}: adaptive`));
  assert.match(source, /Appearance\.setColorScheme/);
  assert.match(source, /theme === 'system'/);
  assert.match(source, /effectiveTheme === 'dark' \? 'light' : 'dark'/);
});
