import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { broadenUntilFound, parseArea, withViewerState, withinArea } from "../lib/feed.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("an absent area is not read as the coordinates zero, zero", () => {
  // `Number(null)` is 0, so a missing parameter used to name a point in the
  // Gulf of Guinea and quietly empty every feed.
  assert.equal(parseArea(new URLSearchParams("limit=20")), null);
  assert.equal(parseArea(new URLSearchParams("lat=&lng=")), null);
  assert.equal(parseArea(new URLSearchParams("lat=abc&lng=xyz")), null);
  assert.equal(parseArea(new URLSearchParams("lat=91&lng=0")), null);
  assert.equal(parseArea(new URLSearchParams("lat=0&lng=181")), null);
  assert.deepEqual(parseArea(new URLSearchParams("lat=0&lng=0")), { latitude: 0, longitude: 0, radiusKm: 25 });
});

test("a requested radius is clamped rather than trusted", () => {
  assert.equal(parseArea(new URLSearchParams("lat=49&lng=-123&radiusKm=99999")).radiusKm, 500);
  assert.equal(parseArea(new URLSearchParams("lat=49&lng=-123&radiusKm=-4")).radiusKm, 1);
  assert.equal(parseArea(new URLSearchParams("lat=49&lng=-123&radiusKm=oops")).radiusKm, 25);
});

test("an empty area widens and then drops the area, and reports which answered", async () => {
  const attempts = [];
  const record = (rows) => (filter) => { attempts.push(filter === undefined ? "everywhere" : "area"); return Promise.resolve(rows(attempts.length)); };
  const area = { latitude: 49.28, longitude: -123.12, radiusKm: 25 };

  const near = await broadenUntilFound(area, record(() => ["a"]));
  assert.deepEqual(near, { rows: ["a"], reach: "requested" });
  assert.deepEqual(attempts, ["area"]);

  attempts.length = 0;
  const wider = await broadenUntilFound(area, record((n) => n === 1 ? [] : ["b"]));
  assert.deepEqual(wider, { rows: ["b"], reach: "widened" });
  assert.deepEqual(attempts, ["area", "area"]);

  attempts.length = 0;
  const everywhere = await broadenUntilFound(area, record((n) => n < 3 ? [] : ["c"]));
  assert.deepEqual(everywhere, { rows: ["c"], reach: "everywhere" });
  assert.deepEqual(attempts, ["area", "area", "everywhere"]);
});

test("asking for no area is not itself a broadening", async () => {
  // Nothing was requested, so nothing was widened — the surface must not claim
  // it is showing results from further out than the viewer asked for.
  const { rows, reach } = await broadenUntilFound(null, () => Promise.resolve(["a"]));
  assert.deepEqual(rows, ["a"]);
  assert.equal(reach, "requested");
});

test("the area filter is a bounding box that grows with the radius", () => {
  // The bounds arrive as boxed numbers among the query's chunks.
  const bounds = (radiusKm) => withinArea({ latitude: 49.28, longitude: -123.12, radiusKm })
    .queryChunks.filter((chunk) => chunk?.constructor === Number).map(Number);
  const narrow = bounds(25);
  const wide = bounds(100);
  // Four edges: south, north, west, east — and a dish with no coordinates at
  // all must be excluded rather than treated as being at the origin.
  assert.equal(narrow.length, 4);
  assert.ok(wide[0] < narrow[0] && wide[1] > narrow[1], "latitude span widens");
  assert.ok(wide[2] < narrow[2] && wide[3] > narrow[3], "longitude span widens");
  const chunks = withinArea({ latitude: 49.28, longitude: -123.12, radiusKm: 25 }).queryChunks;
  const text = chunks.flatMap((chunk) => Array.isArray(chunk?.value) ? chunk.value : []).join(" ");
  assert.match(text, /IS NOT NULL/);
  assert.match(text, /BETWEEN/);
});

test("viewer state reaches the client as booleans", () => {
  assert.deepEqual(withViewerState({ id: "d1", viewerLiked: 1, viewerSaved: 0 }), { id: "d1", viewerLiked: true, viewerSaved: false });
  assert.deepEqual(withViewerState({ id: "d1", viewerLiked: 0, viewerSaved: 2 }), { id: "d1", viewerLiked: false, viewerSaved: true });
});

test("feeds carry like and save state so cards do not fetch their own", async () => {
  const [trending, personal, saves, likeButton, saveButton, card] = await Promise.all([
    source("../app/api/feed/trending/route.ts"),
    source("../app/api/feed/personal/route.ts"),
    source("../app/api/saves/route.ts"),
    source("../components/LikeButton.tsx"),
    source("../components/SaveButton.tsx"),
    source("../components/SocialDishCard.tsx"),
  ]);
  for (const route of [trending, personal, saves]) assert.match(route, /engagementColumns\(/);
  for (const route of [trending, personal, saves]) assert.match(route, /withViewerState\(/);

  // The N+1: one `GET .../like` per card on mount. The button may still ask
  // when nobody told it, but a card that was told must not.
  assert.match(likeButton, /const hydrated = initialLiked !== undefined;/);
  assert.match(likeButton, /if \(hydrated\) return;/);
  assert.doesNotMatch(saveButton, /useEffect/);
  assert.match(card, /initialLiked=\{dish\.viewerLiked\}/);
  assert.match(card, /initialSaved=\{dish\.viewerSaved \?\? false\}/);
});

test("saves reference published dishes rather than numbers from the demo era", async () => {
  const [route, schema, migration] = await Promise.all([
    source("../app/api/saves/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0014_saves_reference_published_dishes.sql"),
  ]);
  assert.match(schema, /dishId: text\("dish_id"\)\.notNull\(\)\.references\(\(\): AnySQLiteColumn => publishedDishes\.id/);
  assert.match(migration, /FOREIGN KEY \(`dish_id`\) REFERENCES `published_dishes`\(`id`\)/);
  // Saving something nobody published is a client bug, and says so.
  assert.match(route, /"dish_not_found"/);
  assert.doesNotMatch(route, /Number\.isInteger\(body\.dishId\)/);
  // Saved renders the shared card, so the payload has to be a whole dish.
  assert.match(route, /innerJoin\(publishedDishes, eq\(publishedDishes\.id, saves\.dishId\)\)/);
});

test("the trending feed states its reach and Discover reports it in the viewer's language", async () => {
  const [route, feed, translations] = await Promise.all([
    source("../app/api/feed/trending/route.ts"),
    source("../components/Feed.tsx"),
    source("../ios/i18n.ts"),
  ]);
  assert.match(route, /reach,/);
  assert.match(feed, /reach !== "requested"/);
  assert.match(feed, /t\(reach === "widened" \? "feed\.widened" : "feed\.everywhere"\)/);
  assert.match(translations, /"feed\.widened":/);
  // The engagement line used to be English assembled in JSX.
  assert.match(feed, /t\("feed\.engagement24h"/);
  assert.doesNotMatch(feed, /comments in the previous 24 hours`/);
});
