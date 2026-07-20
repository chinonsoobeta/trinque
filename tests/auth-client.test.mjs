import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnPath } from "../lib/auth-client.ts";

test("safeReturnPath accepts local paths", () => {
  assert.equal(safeReturnPath("/explore?tab=following"), "/explore?tab=following");
});

test("safeReturnPath rejects open redirects", () => {
  assert.equal(safeReturnPath("https://evil.example"), "/");
  assert.equal(safeReturnPath("//evil.example/path"), "/");
  assert.equal(safeReturnPath("/\\evil.example"), "/");
});
