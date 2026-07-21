import assert from "node:assert/strict";
import test from "node:test";
import { resolveUiLanguage, translate, translations, UI_LANGUAGES } from "../ios/i18n.ts";

test("all UI languages have exact key parity and no fallback key text", () => {
  const reference = Object.keys(translations["en-US"]).sort();
  assert.deepEqual(UI_LANGUAGES, ["en-CA", "en-US", "en-GB", "fr", "es", "de", "it", "pt"]);
  for (const language of UI_LANGUAGES) {
    assert.deepEqual(Object.keys(translations[language]).sort(), reference, `${language} key parity`);
    for (const [key, message] of Object.entries(translations[language])) {
      assert.ok(message.trim(), `${language}:${key} is not empty`);
      assert.notEqual(message, key, `${language}:${key} does not render a fallback key`);
    }
  }
});

test("interpolation preserves localized copy", () => {
  assert.equal(translate("en-GB", "home.curated", { location: "Manchester" }), "Near Manchester");
  assert.equal(translate("fr", "analysis.confident", { confidence: 91 }), "Confiance : 91 %");
  assert.equal(translate("es", "group.groupFit", { score: 88 }), "88% compatible");
});

test("new users receive a supported device-language default including UK English", () => {
  assert.equal(resolveUiLanguage(["en-GB", "fr-FR"]), "en-GB");
  assert.equal(resolveUiLanguage(["fr-CA"]), "fr");
  assert.equal(resolveUiLanguage(["es-MX"]), "es");
  assert.equal(resolveUiLanguage(["de-DE"]), "de");
  assert.equal(resolveUiLanguage(["it-IT"]), "it");
  assert.equal(resolveUiLanguage(["pt-PT"]), "pt");
});

test("non-English catalogues do not fall back to English", () => {
  const keys = Object.keys(translations["en-US"]);
  const allowedSame = {
    fr: new Set(["settings.measurement", "location.imperial", "analysis.field.cuisine", "group.date", "notifications.title", "diet.halal", "dish.source"]),
    es: new Set(["diet.halal", "diet.kosher"]),
    de: new Set(["diet.vegan", "diet.halal", "safety.reason.spam", "onboarding.name"]),
    it: new Set(["auth.account", "auth.password", "diet.halal", "diet.kosher"]),
    pt: new Set(["diet.vegan", "diet.halal", "diet.kosher"]),
  };
  for (const language of ["fr", "es", "de", "it", "pt"]) {
    for (const key of keys) {
      if (allowedSame[language].has(key)) continue;
      assert.notEqual(translations[language][key], translations["en-US"][key], `${language}:${key} must not use English copy`);
    }
  }
});
