import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { capabilityStatus } from "../lib/readiness.ts";
import { selectGooglePlacesKey, selectOpenAIKey } from "../lib/runtime-env.ts";

test("readiness is only complete when every live capability is configured", () => {
  assert.deepEqual(capabilityStatus({ openAIKey: "secret", googlePlacesKey: "places-secret", hasDatabase: true, hasUploads: true }), {
    status: "ready",
    capabilities: {
      openai: { status: "available", reason: "configured" },
      places: { status: "available", reason: "configured" },
      d1: { status: "available", reason: "configured" },
      r2: { status: "available", reason: "configured" },
    },
    liveAnalysis: true,
    locationSearch: true,
    persistence: true,
    uploads: true,
    demoAnalysis: true,
  });
});

test("readiness exposes missing capabilities without exposing a key", () => {
  const status = capabilityStatus({ openAIKey: "", googlePlacesKey: "", hasDatabase: true, hasUploads: false });
  assert.equal(status.status, "degraded");
  assert.equal(status.liveAnalysis, false);
  assert.equal(status.locationSearch, false);
  assert.equal(status.persistence, true);
  assert.equal(status.uploads, false);
  assert.deepEqual(status.capabilities.places, { status: "unavailable", reason: "missing_credential" });
  assert.equal(JSON.stringify(status).includes("secret"), false);
});

test("Sites Worker secrets take precedence while local Node env remains supported", () => {
  assert.equal(selectOpenAIKey(" worker-secret-2 ", "worker-secret", "local-secret-2", "local-secret"), "worker-secret-2");
  assert.equal(selectOpenAIKey(undefined, " worker-secret ", "local-secret-2", "local-secret"), "worker-secret");
  assert.equal(selectOpenAIKey(undefined, undefined, " local-secret-2 ", "local-secret"), "local-secret-2");
  assert.equal(selectOpenAIKey(undefined, undefined, undefined, " local-secret "), "local-secret");
  assert.equal(selectOpenAIKey("", "", "", ""), undefined);
  assert.equal(selectGooglePlacesKey(" canonical-worker ", "legacy-worker", "canonical-node", "legacy-node"), "canonical-worker");
  assert.equal(selectGooglePlacesKey("", " legacy-worker ", "canonical-node", "legacy-node"), "legacy-worker");
  assert.equal(selectGooglePlacesKey(undefined, undefined, " canonical-node ", "legacy-node"), "canonical-node");
  assert.equal(selectGooglePlacesKey("", "", "", " legacy-node "), "legacy-node");
  assert.equal(selectGooglePlacesKey("", "", "", ""), undefined);
});

test("Cloudflare production configuration includes public Supabase auth credentials", () => {
  const wranglerConfig = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

  assert.match(wranglerConfig.vars?.SUPABASE_URL ?? "", /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.match(wranglerConfig.vars?.SUPABASE_PUBLISHABLE_KEY ?? "", /^sb_publishable_.+/);
  assert.equal("SUPABASE_SERVICE_ROLE_KEY" in (wranglerConfig.vars ?? {}), false);
  assert.equal("GCP_API_KEY" in (wranglerConfig.vars ?? {}), false);
  assert.equal("GOOGLE_PLACES_API_KEY" in (wranglerConfig.vars ?? {}), false);
});

test("the deployment architecture has no Vercel integration", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const directPackages = { ...packageJson.dependencies, ...packageJson.devDependencies };
  assert.equal(Object.keys(directPackages).some((name) => name === "vercel" || name.startsWith("@vercel/")), false);
  assert.equal(existsSync(new URL("../vercel.json", import.meta.url)), false);
  assert.equal(existsSync(new URL("../.vercel", import.meta.url)), false);
  assert.equal(existsSync(new URL("../docs/vercel-ui-modernization-notes.md", import.meta.url)), false);
  assert.doesNotMatch(readFileSync(new URL("../.gitignore", import.meta.url), "utf8"), /vercel/i);
});
