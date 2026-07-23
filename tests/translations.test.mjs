import assert from "node:assert/strict";
import test from "node:test";
import { translations } from "../ios/i18n.ts";

const FULL_LANGUAGES = ["fr", "es", "de", "it", "pt"];
const ENGLISH_VARIANTS = ["en-CA", "en-US", "en-GB"];

const enUSKeys = Object.keys(translations["en-US"]).sort();

test("all full languages have exactly the same keys as enUS", () => {
  for (const lang of FULL_LANGUAGES) {
    const keys = Object.keys(translations[lang]).sort();
    const missing = enUSKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !enUSKeys.includes(k));
    assert.deepEqual(
      keys,
      enUSKeys,
      `${lang} key mismatch: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`,
    );
  }
});

test("no empty or whitespace-only translation values", () => {
  for (const lang of FULL_LANGUAGES) {
    for (const [key, value] of Object.entries(translations[lang])) {
      assert.ok(
        typeof value === "string" && value.trim().length > 0,
        `${lang}:${key} is empty or whitespace-only`,
      );
    }
  }
});

test("non-English translations do not fall back to English copy", () => {
  const keys = Object.keys(translations["en-US"]);
  const allowedSame = {
    fr: new Set([
      "settings.measurement",
      "location.imperial",
      "analysis.field.cuisine",
      "group.date",
      "notifications.title",
      "diet.halal",
      "dish.source",
    ]),
    es: new Set(["diet.halal", "diet.kosher"]),
    de: new Set(["diet.halal"]),
    it: new Set(["diet.halal"]),
    pt: new Set(["diet.halal"]),
  };
  for (const lang of FULL_LANGUAGES) {
    for (const key of keys) {
      if (allowedSame[lang]?.has(key)) continue;
      const enValue = translations["en-US"][key];
      const langValue = translations[lang][key];
      assert.notEqual(
        langValue,
        enValue,
        `${lang}:${key} equals en-US value "${enValue}" — probably an untranslated fallback`,
      );
    }
  }
});

test("no provider codes or internal technical terms in user-facing values", () => {
  const technicalTerms = /\b(?:API|endpoint|payload|metadata|OAuth|HTTP)\b/i;
  for (const lang of FULL_LANGUAGES) {
    for (const [key, value] of Object.entries(translations[lang])) {
      assert.doesNotMatch(value, technicalTerms, `${lang}:${key} contains a technical term`);
      assert.doesNotMatch(
        value,
        /\b(?:seed_demo|ai_identified|community_submitted|restaurant_verified|menu_imported)\b/,
        `${lang}:${key} contains an internal provider/code value`,
      );
    }
  }
});

test("English variants have fewer or equal keys than enUS", () => {
  for (const lang of ENGLISH_VARIANTS) {
    const keys = Object.keys(translations[lang]).sort();
    for (const key of keys) {
      assert.ok(
        enUSKeys.includes(key),
        `${lang} has key "${key}" that does not exist in enUS`,
      );
    }
    assert.ok(
      keys.length <= enUSKeys.length,
      `${lang} has ${keys.length} keys, but enUS has ${enUSKeys.length}`,
    );
  }
});
