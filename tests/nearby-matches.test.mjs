import assert from "node:assert/strict";
import test from "node:test";
import { rankNearbyMatches } from "../lib/nearby-matches.ts";

test("published pasta fields produce explainable nearby pasta matches", () => {
  const matches = rankNearbyMatches({ name: "Sage ravioli", cuisine: "Northern Italian", ingredients: "filled pasta brown butter sage parmesan", dietary: "Vegetarian, dairy and gluten", confidence: 91, description: "Silky, buttery and bright with lemon" });
  assert.equal(matches[0].id, "oca-agnolotti");
  assert.match(matches[0].explanation, /shares/i);
  assert.ok(matches[0].score > matches.at(-1).score);
});

test("changing reviewed fields changes the nearby ranking", () => {
  const matches = rankNearbyMatches({ name: "Spicy miso noodles", cuisine: "Japanese", ingredients: "miso broth wheat noodles corn scallion chile oil", dietary: "Contains soy and gluten", confidence: 90, description: "Smoky umami broth with charred corn" });
  assert.equal(matches[0].id, "maruhachi-ramen");
  assert.notEqual(matches[0].id, "oca-agnolotti");
});
