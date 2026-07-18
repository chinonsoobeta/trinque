import { access, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { analyzeDishWithOpenAI } from "../lib/dish-analysis.ts";

const planPath = resolve(process.cwd(), "evaluation/corpus-plan.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const fixtures = plan.cases.filter((item) => item.approved === true && typeof item.imagePath === "string");
const coverage = summarize(plan.cases);

if (!process.argv.includes("--run")) {
  console.log(JSON.stringify({ status: "unmeasured", reason: "Run only approved image fixtures with --run; no score is inferred from the corpus plan.", planned: plan.cases.length, approvedFixtures: fixtures.length, coverage }, null, 2));
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for a measured run and must remain server-side.");
if (fixtures.length === 0) throw new Error("No approved fixture image paths are configured; results remain unmeasured.");

const results = [];
for (const fixture of fixtures) {
  const path = resolve(process.cwd(), fixture.imagePath);
  await access(path);
  const bytes = await readFile(path);
  const mime = mimeFor(path);
  const started = performance.now();
  const response = await analyzeDishWithOpenAI({ imageDataUrl: `data:${mime};base64,${bytes.toString("base64")}`, apiKey: process.env.OPENAI_API_KEY, requestId: crypto.randomUUID(), language: fixture.language });
  const latencyMs = Math.round(performance.now() - started);
  results.push(scoreFixture(fixture, response, latencyMs));
}

console.log(JSON.stringify({ status: "measured", measuredAt: new Date().toISOString(), sampleSize: results.length, metrics: metrics(results), breakdowns: { country: breakdown(results, "country"), language: breakdown(results, "language"), cuisine: breakdown(results, "expectedCuisine") }, results }, null, 2));

function scoreFixture(fixture, response, latencyMs) {
  if (!response.ok) return { id: fixture.id, country: fixture.country, language: fixture.language, expectedCuisine: fixture.cuisineAliases[0], expectedReadable: fixture.expectedReadable, providerFailure: true, readableCorrect: fixture.expectedReadable === false, latencyMs };
  const normalizedName = normalize(response.result.name);
  const normalizedCuisine = normalize(response.result.cuisine);
  const canonicalIngredients = response.result.canonical.ingredients.map(normalize);
  const expectedIngredients = fixture.ingredients.map(normalize);
  const ingredientHits = canonicalIngredients.filter((actual) => expectedIngredients.some((expected) => actual.includes(expected) || expected.includes(actual))).length;
  const readable = normalizedName !== "unknown" && response.result.confidence > 25;
  return {
    id: fixture.id, country: fixture.country, language: fixture.language, expectedCuisine: fixture.cuisineAliases[0], expectedReadable: fixture.expectedReadable, providerFailure: false, latencyMs,
    prediction: { name: response.result.name, cuisine: response.result.cuisine, ingredients: response.result.canonical.ingredients, dietary: response.result.dietary },
    dishNameCorrect: fixture.dishAliases.some((alias) => normalizedName.includes(normalize(alias))),
    cuisineCorrect: fixture.cuisineAliases.some((alias) => normalizedCuisine.includes(normalize(alias))),
    ingredientPrecision: canonicalIngredients.length ? ingredientHits / canonicalIngredients.length : expectedIngredients.length === 0 ? 1 : 0,
    unsupportedAllergenClaim: /allergen[- ]free|safe for|free from|sans allerg[eè]ne|libre de al[eé]rgenos/i.test(response.result.dietary),
    readableCorrect: readable === fixture.expectedReadable,
    confidence: response.result.confidence,
    confidenceCorrect: fixture.expectedReadable ? Number(response.result.confidence) / 100 : 1 - Number(response.result.confidence) / 100,
  };
}

function metrics(results) {
  const successes = results.filter((item) => !item.providerFailure);
  const readableSuccesses = successes.filter((item) => item.expectedReadable);
  return {
    dishNameAccuracy: ratio(readableSuccesses, "dishNameCorrect"), cuisineAccuracy: ratio(readableSuccesses, "cuisineCorrect"),
    ingredientPrecision: average(readableSuccesses.map((item) => item.ingredientPrecision)), unsupportedAllergenClaimRate: ratio(successes, "unsupportedAllergenClaim"),
    confidenceCalibration: average(successes.map((item) => item.confidenceCorrect)), unreadableRejectionAccuracy: ratio(results, "readableCorrect"),
    latencyMs: { mean: average(results.map((item) => item.latencyMs)), p95: percentile(results.map((item) => item.latencyMs), .95) }, providerFailureRate: results.filter((item) => item.providerFailure).length / results.length,
  };
}

function breakdown(results, key) { return Object.fromEntries([...new Set(results.map((item) => item[key]))].map((value) => { const group = results.filter((item) => item[key] === value); return [value, { sampleSize: group.length, metrics: metrics(group) }]; })); }
function summarize(cases) { return { countries: counts(cases, "country"), languages: counts(cases, "language"), categories: counts(cases, "category") }; }
function counts(items, key) { return Object.fromEntries([...new Set(items.map((item) => item[key]))].map((value) => [value, items.filter((item) => item[key] === value).length])); }
function ratio(items, key) { return items.length ? items.filter((item) => item[key] === true).length / items.length : null; }
function average(values) { const usable = values.filter(Number.isFinite); return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null; }
function percentile(values, p) { const usable = values.filter(Number.isFinite).sort((a, b) => a - b); return usable.length ? usable[Math.min(usable.length - 1, Math.ceil(usable.length * p) - 1)] : null; }
function normalize(value) { return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function mimeFor(path) { const extension = extname(path).toLowerCase(); if (extension === ".png") return "image/png"; if (extension === ".webp") return "image/webp"; if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"; throw new Error(`Unsupported fixture extension: ${extension}`); }
