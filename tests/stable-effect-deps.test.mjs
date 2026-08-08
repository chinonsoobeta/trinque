import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

async function clientSources() {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (next.endsWith(".tsx") || next.endsWith(".ts")) files.push(next);
    }
  }
  await walk("app");
  await walk("components");
  return Promise.all(files.map(async (file) => [file, await readFile(path.join(root, file), "utf8")]));
}

test("no effect or callback depends on the translator", async () => {
  // `useUiText` returns a new `t` whenever the language store settles, which it
  // does once on hydration for anyone whose language is not the server default.
  // Anything listing `t` in its dependencies therefore runs a second time — the
  // feed fetched itself twice, and the OAuth callback re-exchanged a code that
  // may only be used once.
  const offenders = [];
  for (const [file, source] of await clientSources()) {
    for (const match of source.matchAll(/\}, \[[^\]]*\]\);/g)) {
      // Keeping a ref in step with `t` is the sanctioned way to reach the current
      // translator from work that must not re-run, so it is allowed to name it.
      if (source.slice(Math.max(0, match.index - 80), match.index).includes(".current = t;")) continue;
      const dep = match[0];
      const names = dep.slice(dep.indexOf("[") + 1, dep.lastIndexOf("]")).split(",").map((name) => name.trim());
      if (names.includes("t")) offenders.push(`${file}: ${dep}`);
    }
  }
  assert.deepEqual(offenders, [], `translator in dependency arrays:\n${offenders.join("\n")}`);
});

test("authHeaders keeps one identity for the life of the provider", async () => {
  // Consumers list it in dependency arrays, so a fresh function on every context
  // recompute meant each of them refetched two or three times while the session
  // was still settling.
  const source = await readFile(path.join(root, "components/AuthProvider.tsx"), "utf8");
  assert.match(source, /const authHeaders = useCallback\(\(\): Record<string, string> => \{/);
  assert.match(source, /\}, \[\]\);/);
  assert.doesNotMatch(source, /authHeaders: \(\): Record<string, string> =>/);
});
