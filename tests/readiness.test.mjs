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
      database: { status: "available", reason: "configured" },
      storage: { status: "available", reason: "configured" },
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

test("no secret ever appears in a committed, publicly readable configuration file", () => {
  const environmentTemplate = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const secret of ["SUPABASE_SERVICE_ROLE_KEY", "TURSO_AUTH_TOKEN", "OPENAI_API_KEY_2", "GCP_API_KEY"]) {
    assert.match(environmentTemplate, new RegExp(`^${secret}=$`, "m"), `${secret} must be present but empty in .env.example`);
  }
});

test("the deployment architecture is Vercel-native with no Cloudflare entry points left", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
  assert.equal(packageJson.scripts.dev, "next dev");

  const directPackages = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const removed of ["vinext", "wrangler", "@cloudflare/vite-plugin", "@vitejs/plugin-rsc", "react-server-dom-webpack"]) {
    assert.equal(removed in directPackages, false, `${removed} is a Cloudflare-only dependency`);
  }
  assert.equal("@libsql/client" in packageJson.dependencies, true);

  for (const removed of ["../worker/index.ts", "../vite.config.ts", "../wrangler.jsonc", "../.openai/hosting.json"]) {
    assert.equal(existsSync(new URL(removed, import.meta.url)), false, `${removed} still exists`);
  }
  assert.equal(existsSync(new URL("../proxy.ts", import.meta.url)), true);
  assert.doesNotMatch(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"), /from "cloudflare:/);
});
