import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PILOT_ANCHORS } from "../lib/pilot-anchors.ts";
import { normalizeLocation } from "../lib/location.ts";

test("pilot anchors cover every required validation region without becoming a runtime city allowlist", () => {
  assert.equal(PILOT_ANCHORS.length, 15);
  assert.deepEqual([...new Set(PILOT_ANCHORS.map((anchor) => anchor.countryCode))].sort(), ["CA", "FR", "GB", "MX", "US"]);
  for (const anchor of PILOT_ANCHORS) {
    const normalized = normalizeLocation(anchor, anchor.language);
    assert.equal(normalized.countryCode, anchor.countryCode);
    assert.equal(normalized.locality, anchor.locality);
    assert.ok(normalized.latitude >= -90 && normalized.latitude <= 90);
    assert.ok(normalized.longitude >= -180 && normalized.longitude <= 180);
  }
});

test("pilot readiness report records blockers and measured/unmeasured boundaries", async () => {
  const report = await readFile(new URL("../docs/pilot-readiness-report.md", import.meta.url), "utf8");
  assert.match(report, /NO-GO/);
  assert.match(report, /GOOGLE_PLACES_API_KEY/);
  assert.match(report, /unmeasured/i);
  assert.match(report, /owner-only/);
  assert.match(report, /three-session/);
  assert.match(report, /No runtime city allowlist/i);
});
