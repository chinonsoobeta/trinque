import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { resolveUiLanguage, translate, translations, UI_LANGUAGES } from "../ios/i18n.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");

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

test("all English regions use the final plain-language review", () => {
  for (const language of ["en-CA", "en-US", "en-GB"]) {
    assert.equal(translations[language]["home.analyze"], "Check a dish");
    assert.equal(translations[language]["home.gather"], "Good choices");
    assert.equal(translations[language]["group.lock"], "Choose this place");
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
    de: new Set(["diet.halal"]),
    it: new Set(["diet.halal"]),
    pt: new Set(["diet.halal"]),
  };
  for (const language of ["fr", "es", "de", "it", "pt"]) {
    for (const key of keys) {
      if (allowedSame[language].has(key)) continue;
      assert.notEqual(translations[language][key], translations["en-US"][key], `${language}:${key} must not use English copy`);
    }
  }
});

test("user-facing catalogues do not use technical terms", () => {
  const technicalTerms = /\b(?:API|endpoint|payload|metadata|canonical|semantic|OAuth|HTTP)\b/i;
  for (const language of UI_LANGUAGES) {
    for (const [key, message] of Object.entries(translations[language])) {
      assert.doesNotMatch(message, technicalTerms, `${language}:${key} contains a technical term`);
    }
  }
});

test("catalogue prose stays short and avoids reviewed jargon and model names", () => {
  const localJargon = {
    "en-US": /\b(?:provider|payload|canonical|semantic|GPT-\d)\b/i,
    fr: /\b(?:fournisseur|normalis\w*|dossier|admissible|GPT-\d)\b/i,
    es: /\b(?:proveedor|normaliz\w*|registro|elegible|GPT-\d)\b/i,
    de: /\b(?:Provider|Metadaten|Endpunkt|GPT-\d)\b/i,
    it: /\b(?:provider|metadati|endpoint|GPT-\d)\b/i,
    pt: /\b(?:fornecedor|metadados|endpoint|GPT-\d)\b/i,
  };
  for (const language of ["en-US", "fr", "es", "de", "it", "pt"]) {
    for (const [key, message] of Object.entries(translations[language])) {
      assert.doesNotMatch(message, localJargon[language], `${language}:${key} contains reviewed jargon`);
      for (const sentence of message.split(/[.!?…]+/)) {
        const words = sentence.match(/[\p{L}\p{N}{}%-]+/gu) ?? [];
        assert.ok(words.length <= 24, `${language}:${key} has a sentence longer than 24 words`);
      }
    }
  }
});

test("main interactive views do not contain raw user-facing prose", () => {
  function sourceFiles(directory) {
    return readdirSync(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(`${directory}/${entry.name}`) : entry.name.endsWith(".tsx") ? [`${directory}/${entry.name}`] : []);
  }
  const files = [...sourceFiles("app"), ...sourceFiles("components"), "ios/App.tsx"];
  const allowedMarks = new Set(["Trinque", "T", "G", "Google Maps", "i", "YYYY-MM-DD"]);
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node)) {
        const text = node.text.trim();
        if (/\p{L}/u.test(text)) assert.ok(allowedMarks.has(text), `${file} contains raw UI text: ${text}`);
      }
      if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "alt", "accessibilityLabel", "accessibilityHint"].includes(node.name.text) && node.initializer) {
        if (ts.isStringLiteral(node.initializer) && /\p{L}/u.test(node.initializer.text)) assert.ok(allowedMarks.has(node.initializer.text), `${file} contains a raw UI attribute: ${node.initializer.text}`);
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isTemplateExpression(node.initializer.expression)) {
          const prose = [node.initializer.expression.head.text, ...node.initializer.expression.templateSpans.map((span) => span.literal.text)].join(" ").trim();
          assert.doesNotMatch(prose, /\p{L}/u, `${file} contains raw UI template text: ${prose}`);
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["setStatus", "setError", "setAnalysisError", "setAnalysisWarning"].includes(node.expression.text)) {
        const value = node.arguments[0];
        if (value && ts.isStringLiteral(value) && value.text) assert.fail(`${file} exposes a raw status: ${value.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
});
