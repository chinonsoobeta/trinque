import assert from "node:assert/strict";
import test from "node:test";
import { rankDemoNearbyMatches } from "../lib/nearby-matches.ts";

test("explicit demo mode produces explainable seeded pasta matches", () => {
  const matches = rankDemoNearbyMatches({ name: "Sage ravioli", cuisine: "Northern Italian", ingredients: "filled pasta brown butter sage parmesan", dietary: "Vegetarian, dairy and gluten", confidence: 91, description: "Silky, buttery and bright with lemon", canonical: { dishName: "ravioli", cuisine: "northern italian", ingredients: ["pasta", "butter", "sage"], flavours: ["silky", "nutty"], metadataSource: "user_reviewed" } });
  assert.equal(matches[0].id, "oca-agnolotti");
  assert.match(matches[0].explanation, /shares/i);
  assert.ok(matches[0].score > matches.at(-1).score);
});

test("changing reviewed fields changes the nearby ranking", () => {
  const matches = rankDemoNearbyMatches({ name: "Spicy miso noodles", cuisine: "Japanese", ingredients: "miso broth wheat noodles corn scallion chile oil", dietary: "Contains soy and gluten", confidence: 90, description: "Smoky umami broth with charred corn", canonical: { dishName: "miso noodles", cuisine: "japanese", ingredients: ["miso", "noodles", "corn"], flavours: ["smoky", "umami"], metadataSource: "user_reviewed" } });
  assert.equal(matches[0].id, "maruhachi-ramen");
  assert.notEqual(matches[0].id, "oca-agnolotti");
});
