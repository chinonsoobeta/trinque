import assert from "node:assert/strict";
import test from "node:test";
import { capabilityStatus } from "../lib/readiness.ts";

test("readiness is only complete when all live capabilities are configured", () => {
  assert.deepEqual(capabilityStatus({ openAIKey: "secret", hasDatabase: true, hasUploads: true }), {
    status: "ready",
    liveAnalysis: true,
    persistence: true,
    uploads: true,
    demoAnalysis: true,
  });
});

test("readiness exposes missing capabilities without exposing a key", () => {
  const status = capabilityStatus({ openAIKey: "", hasDatabase: true, hasUploads: false });
  assert.equal(status.status, "degraded");
  assert.equal(status.liveAnalysis, false);
  assert.equal(status.persistence, true);
  assert.equal(status.uploads, false);
  assert.equal(JSON.stringify(status).includes("secret"), false);
});
