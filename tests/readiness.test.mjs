import assert from "node:assert/strict";
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

test("configured secrets take precedence while a local fallback remains supported", () => {
  assert.equal(selectOpenAIKey(" primary-secret ", "fallback-secret"), "primary-secret");
  assert.equal(selectOpenAIKey(undefined, " fallback-secret "), "fallback-secret");
  assert.equal(selectOpenAIKey("", ""), undefined);
  assert.equal(selectGooglePlacesKey(" places-primary ", "places-fallback"), "places-primary");
});
