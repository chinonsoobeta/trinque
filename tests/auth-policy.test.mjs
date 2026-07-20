import assert from "node:assert/strict";
import test from "node:test";
import { requiresAuthenticatedLegacyMutation } from "../lib/auth-policy.ts";

function request(method, path) { return { method, url: `https://trinque.test${path}` }; }

test("public dish/group reads remain guest-capable", () => {
  assert.equal(requiresAuthenticatedLegacyMutation(request("GET", "/api/dishes")), false);
  assert.equal(requiresAuthenticatedLegacyMutation(request("GET", "/api/groups/abc")), false);
  assert.equal(requiresAuthenticatedLegacyMutation(request("OPTIONS", "/api/groups")), false);
});

test("dish and group mutations require authenticated accounts", () => {
  for (const [method, path] of [["POST", "/api/dishes"], ["DELETE", "/api/dishes/abc"], ["PATCH", "/api/dishes/abc"], ["POST", "/api/groups"], ["POST", "/api/groups/join"], ["DELETE", "/api/groups/abc"]]) {
    assert.equal(requiresAuthenticatedLegacyMutation(request(method, path)), true, `${method} ${path}`);
  }
});

test("unrelated legacy guest workflows are not broadly locked", () => {
  assert.equal(requiresAuthenticatedLegacyMutation(request("POST", "/api/analyze")), false);
  assert.equal(requiresAuthenticatedLegacyMutation(request("POST", "/api/privacy/consent")), false);
  assert.equal(requiresAuthenticatedLegacyMutation(request("POST", "/api/preferences")), false);
});
