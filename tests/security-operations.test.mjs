import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { corsHeaders } from "../lib/cors.ts";
import { requestIdFor } from "../lib/operations.ts";
import { decodeDishImage } from "../lib/uploads.ts";

const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

test("decoded uploads require matching PNG, JPEG, or WebP signatures", () => {
  assert.equal(decodeDishImage(dataUrl("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).contentType, "image/png");
  assert.equal(decodeDishImage(dataUrl("image/jpeg", [0xff, 0xd8, 0xff, 0xe0])).contentType, "image/jpeg");
  assert.equal(decodeDishImage(dataUrl("image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])).contentType, "image/webp");
  assert.throws(() => decodeDishImage(dataUrl("image/png", [0xff, 0xd8, 0xff])), /invalid_image/);
  assert.throws(() => decodeDishImage("data:image/svg+xml;base64,PHN2Zz4="), /invalid_image/);
});

test("request IDs are bounded and wildcard CORS is absent", async () => {
  assert.equal(requestIdFor(new Request("https://trinque.example", { headers: { "x-request-id": "pilot_req_1234" } })), "pilot_req_1234");
  assert.notEqual(requestIdFor(new Request("https://trinque.example", { headers: { "x-request-id": "bad id" } })), "bad id");
  const sameOrigin = await corsHeaders(new Request("https://trinque.example/api/analyze", { headers: { origin: "https://trinque.example" } }), "POST, OPTIONS");
  const disallowed = await corsHeaders(new Request("https://trinque.example/api/analyze", { headers: { origin: "https://attacker.example" } }), "POST, OPTIONS");
  assert.equal(sameOrigin.get("access-control-allow-origin"), "https://trinque.example");
  assert.equal(disallowed.has("access-control-allow-origin"), false);
});

test("sensitive routes use budgets and expose deletion/export controls without logging payloads", async () => {
  const files = await Promise.all(["../app/api/analyze/route.ts", "../app/api/dishes/route.ts", "../app/api/groups/join/route.ts", "../app/api/groups/[id]/vote/route.ts", "../app/api/locations/autocomplete/route.ts", "../app/api/privacy/route.ts", "../app/api/privacy/export/route.ts", "../lib/operations.ts"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const [index, action] of ["analysis", "publish", "invite_join", "vote", "places"].entries()) assert.match(files[index], new RegExp(`enforceUsageBudget\\(\\"${action}\\"`));
  assert.match(files[5], /export async function DELETE/);
  assert.match(files[5], /imageRetentionConsent === false/);
  assert.match(files[6], /Content-Disposition/);
  assert.doesNotMatch(files[7], /authorization|imageDataUrl|request\.body|email/i);
});
