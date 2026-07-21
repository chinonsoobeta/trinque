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

test("social writes require completed onboarding and safety reads filter user choices", async () => {
  const files = await Promise.all([
    "../app/api/dishes/route.ts", "../app/api/dishes/[id]/route.ts", "../app/api/dishes/[id]/comments/route.ts",
    "../app/api/groups/route.ts", "../app/api/groups/join/route.ts", "../app/api/groups/[id]/vote/route.ts",
    "../app/api/groups/[id]/finalize/route.ts", "../app/api/groups/[id]/rsvp/route.ts", "../app/api/profiles/[handle]/follow/route.ts",
    "../app/api/feed/personal/route.ts", "../app/api/notifications/route.ts", "../app/api/dishes/[id]/comments/[commentId]/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const index of [...Array(9).keys()]) assert.match(files[index], /requireOnboardedIdentity/);
  assert.match(files[9], /hiddenDishes/);
  assert.match(files[9], /blocks/);
  assert.match(files[9], /mutes/);
  assert.match(files[10], /blocks/);
  assert.match(files[10], /mutes/);
  assert.match(files[11], /publishedDishes\.ownerId/);
  assert.match(files[11], /moderationStatus: "deleted"/);
});

test("PWA cache policy excludes private API responses and uploads", async () => {
  const [worker, manifest] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.match(manifest, /"display"\s*:\s*"standalone"/);
});

test("safety controls are present on dish, profile, and comment surfaces", async () => {
  const [actions, dish, dishView, profile, comments, route, invite] = await Promise.all([
    readFile(new URL("../components/SafetyActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dishes/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DishDetailView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ProfileView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/CommentSection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/safety/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/groups/[id]/invite/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /\/api\/reports/);
  for (const action of ["hide", "mute", "block"]) assert.match(actions, new RegExp(`\"${action}\"`));
  assert.match(dish, /DishDetailView/);
  assert.match(dishView, /SafetyActions/);
  assert.match(profile, /SafetyActions/);
  assert.match(comments, /targetType="comment"/);
  assert.match(comments, /dishOwnerId/);
  assert.match(route, /db\.delete\(follows\)/);
  assert.match(route, /db\.delete\(notifications\)/);
  assert.match(invite, /blocks\.blockerId/);
});

test("iOS exposes the same core dish safety actions", async () => {
  const source = await readFile(new URL("../ios/App.tsx", import.meta.url), "utf8");
  assert.match(source, /safety\.reportDish/);
  assert.match(source, /action: 'hide'/);
  assert.match(source, /action: 'mute'/);
  assert.match(source, /action: 'block'/);
  assert.match(source, /onHide\(dish\.id\)/);
  assert.match(source, /safety\.reportReason/);
  assert.match(source, /safety\.blockConfirm/);
});

test("users can review safety choices and moderators have a guarded queue", async () => {
  const [center, account, moderationPage, moderationRoute, safetyRoute] = await Promise.all([
    readFile(new URL("../components/SafetyCenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/moderation/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/safety/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(account, /SafetyCenter/);
  for (const action of ["block", "mute", "hide"]) assert.match(center, new RegExp(`action: "${action}"`));
  assert.match(safetyRoute, /export async function GET/);
  assert.match(moderationPage, /\/api\/moderation/);
  assert.match(moderationRoute, /isModerator/);
  assert.match(moderationRoute, /moderator_required/);
});
