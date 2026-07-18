import assert from "node:assert/strict";
import test from "node:test";
import { resolveUiLanguage, translate, translations, UI_LANGUAGES } from "../ios/i18n.ts";

test("all five UI languages have exact key parity and no fallback key text", () => {
  const reference = Object.keys(translations["en-US"]).sort();
  assert.deepEqual(UI_LANGUAGES, ["en-CA", "en-US", "en-GB", "fr", "es"]);
  for (const language of UI_LANGUAGES) {
    assert.deepEqual(Object.keys(translations[language]).sort(), reference, `${language} key parity`);
    for (const [key, message] of Object.entries(translations[language])) {
      assert.ok(message.trim(), `${language}:${key} is not empty`);
      assert.notEqual(message, key, `${language}:${key} does not render a fallback key`);
    }
  }
});

test("interpolation preserves localized copy", () => {
  assert.equal(translate("en-GB", "home.curated", { location: "Manchester" }), "Curated near Manchester");
  assert.equal(translate("fr", "analysis.confident", { confidence: 91 }), "Confiance : 91 %");
  assert.equal(translate("es", "group.groupFit", { score: 88 }), "88% compatible");
});

test("new users receive a supported device-language default including UK English", () => {
  assert.equal(resolveUiLanguage(["en-GB", "fr-FR"]), "en-GB");
  assert.equal(resolveUiLanguage(["fr-CA"]), "fr");
  assert.equal(resolveUiLanguage(["es-MX"]), "es");
  assert.equal(resolveUiLanguage(["de-DE"]), "en-CA");
});
