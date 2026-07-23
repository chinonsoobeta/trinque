import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("test", String(Date.now()));
  return (await import(url.href)).default;
}
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the Trinque experience", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  const html = await response.text();
  assert.match(html, /<title>Trinque — Find dishes with friends<\/title>/i);
  assert.match(html, /Find good food with friends\./);
  assert.match(html, /Check a dish/);
  assert.match(html, /Change location/);
  assert.match(html, /Try the labeled demo/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("worker CORS permits only same-origin or explicitly configured browser origins", async () => {
  const app = await worker();
  const sameOrigin = await app.fetch(new Request("http://localhost/api/health", {
    method: "OPTIONS", headers: { origin: "http://localhost" },
  }), env, ctx);
  assert.equal(sameOrigin.status, 204);
  assert.equal(sameOrigin.headers.get("access-control-allow-origin"), "http://localhost");

  const rejected = await app.fetch(new Request("http://localhost/api/health", {
    method: "OPTIONS", headers: { origin: "https://attacker.example" },
  }), env, ctx);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.has("access-control-allow-origin"), false);

  const configured = await app.fetch(new Request("http://localhost/api/health", {
    method: "OPTIONS", headers: { origin: "https://ios-webview.trinque.example" },
  }), { ...env, TRINQUE_ALLOWED_ORIGINS: "https://ios-webview.trinque.example" }, ctx);
  assert.equal(configured.status, 204);
  assert.equal(configured.headers.get("access-control-allow-origin"), "https://ios-webview.trinque.example");
});

test("returns deterministic analysis without credentials", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/api/analyze", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ demo: true }),
  }), env, ctx);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.mode, "demo");
  assert.equal(result.result.name, "Brown butter agnolotti");
  assert.equal(result.result.confidence, 94);
  assert.match(result.warning, /seeded demo/i);
});

test("does not silently return demo data when live analysis is not configured", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/api/analyze", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,dGVzdA==" }),
  }), env, ctx);
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.equal(result.mode, "unavailable");
  assert.equal(result.error.code, "live_not_configured");
  assert.equal("result" in result, false);
});
