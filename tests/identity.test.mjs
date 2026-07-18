import assert from "node:assert/strict";
import test from "node:test";
import { guestTokenFromRequest } from "../lib/guest-token.ts";

test("accepts a well-formed guest authorization token", () => {
  const token = "a".repeat(64);
  assert.equal(guestTokenFromRequest(new Request("https://trinque.test", { headers: { authorization: `Guest ${token}` } })), token);
});

test("rejects malformed or non-guest authorization", () => {
  assert.equal(guestTokenFromRequest(new Request("https://trinque.test", { headers: { authorization: "Bearer secret" } })), null);
  assert.equal(guestTokenFromRequest(new Request("https://trinque.test", { headers: { authorization: "Guest short" } })), null);
});
