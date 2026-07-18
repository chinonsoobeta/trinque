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
  assert.equal(selectOpenAIKey(" worker-secret ", "local-secret"), "worker-secret");
  assert.equal(selectOpenAIKey(undefined, " local-secret "), "local-secret");
  assert.equal(selectOpenAIKey("", ""), undefined);
  assert.equal(selectGooglePlacesKey(" places-worker ", "places-local"), "places-worker");
});
