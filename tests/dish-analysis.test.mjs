import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDishWithOpenAI, demoEnvelope } from "../lib/dish-analysis.ts";

const liveResult = {
  name: "Jollof rice with grilled chicken",
  cuisine: "West African",
  ingredients: "Rice, tomato, pepper, spices, grilled chicken",
  dietary: "Confirm stock ingredients and cross-contact",
  confidence: 92,
  description: "Smoky tomato rice paired with deeply seasoned grilled chicken.",
  canonical: { dishName: "jollof rice with grilled chicken", cuisine: "west african", ingredients: ["rice", "tomato", "pepper", "chicken"], flavours: ["smoky", "spiced"], metadataSource: "ai_normalized" },
};

test("labels deterministic fixtures as demo data", () => {
  const result = demoEnvelope("req-demo", "ramen");
  assert.equal(result.ok, true);
  assert.equal(result.mode, "demo");
  assert.equal(result.result.name, "Charred miso ramen");
  assert.match(result.warning, /seeded demo data/i);
});

test("returns a distinctly labeled live vision result", async () => {
  let requestBody;
  const result = await analyzeDishWithOpenAI({
    imageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    apiKey: "test-key",
    requestId: "req-live",
    language: "en-GB",
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(liveResult) }] }] }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.result.name, liveResult.name);
  assert.equal(requestBody.input[0].content[1].detail, "high");
  assert.equal(requestBody.model, "gpt-5.6-sol");
  assert.match(requestBody.instructions, /en-GB/);
  assert.equal(requestBody.text.format.schema.properties.canonical.properties.metadataSource.enum[0], "ai_normalized");
});

test("does not silently substitute demo data after provider failure", async () => {
  const result = await analyzeDishWithOpenAI({
    imageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    apiKey: "test-key",
    requestId: "req-failure",
    fetcher: async () => new Response("rate limited", { status: 429 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.mode, "unavailable");
  assert.equal(result.error.code, "provider_error");
  assert.equal("result" in result, false);
});

test("rejects malformed provider output instead of presenting it as identification", async () => {
  const result = await analyzeDishWithOpenAI({
    imageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    apiKey: "test-key",
    requestId: "req-malformed",
    fetcher: async () => new Response(JSON.stringify({ output: [] }), { status: 200 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_provider_response");
});
