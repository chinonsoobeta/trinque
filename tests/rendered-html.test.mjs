import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test, { after, before } from "node:test";

const CONFIGURED_ORIGIN = "https://ios-webview.trinque.example";

let server;
let base;

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForReady(url, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "text/html" } });
      if (response.status < 500) return;
    } catch {
      // The server is still binding; retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready at ${url}`);
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, TRINQUE_ALLOWED_ORIGINS: CONFIGURED_ORIGIN, NODE_ENV: "production" },
    stdio: "ignore",
  });
  await waitForReady(base);
});

after(() => {
  server?.kill("SIGTERM");
});

test("server-renders the Trinque experience", async () => {
  const response = await fetch(base, { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  const html = await response.text();
  assert.match(html, /<title>Trinque — Good food finds good company<\/title>/i);
  assert.match(html, /Good food finds good company\./);
  assert.match(html, /Analyze a dish/);
  assert.match(html, /Worth gathering around/);
  assert.match(html, /GPT-5\.6/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("CORS permits only same-origin or explicitly configured browser origins", async () => {
  const sameOrigin = await fetch(`${base}/api/health`, { method: "OPTIONS", headers: { origin: base } });
  assert.equal(sameOrigin.status, 204);
  assert.equal(sameOrigin.headers.get("access-control-allow-origin"), base);

  const rejected = await fetch(`${base}/api/health`, { method: "OPTIONS", headers: { origin: "https://attacker.example" } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.has("access-control-allow-origin"), false);

  const configured = await fetch(`${base}/api/health`, { method: "OPTIONS", headers: { origin: CONFIGURED_ORIGIN } });
  assert.equal(configured.status, 204);
  assert.equal(configured.headers.get("access-control-allow-origin"), CONFIGURED_ORIGIN);
});

test("returns deterministic analysis without credentials", async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ demo: true }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.mode, "demo");
  assert.equal(result.result.name, "Brown butter agnolotti");
  assert.equal(result.result.confidence, 94);
  assert.match(result.warning, /seeded demo/i);
});

test("does not silently return demo data when live analysis is not configured", async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,dGVzdA==" }),
  });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.equal(result.mode, "unavailable");
  assert.equal(result.error.code, "live_not_configured");
  assert.equal("result" in result, false);
});
