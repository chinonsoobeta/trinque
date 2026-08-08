import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ANALYTICS_EVENTS, parseAnalyticsInput } from "../lib/analytics.ts";

test("consent-aware analytics accepts only the eleven approved event contracts", () => {
  assert.deepEqual(ANALYTICS_EVENTS, ["analysis_started", "analysis_completed", "analysis_failed", "analysis_corrected", "dish_published", "match_opened", "group_created", "invite_joined", "vote_cast", "plan_finalized", "rsvp_submitted"]);
  assert.deepEqual(parseAnalyticsInput({ event: "analysis_completed", language: "en-GB", countryCode: "GB", mode: "live", outcome: "success", durationMs: 1200 }), { event: "analysis_completed", language: "en-GB", countryCode: "GB", mode: "live", outcome: "success", durationMs: 1200 });
  assert.equal(parseAnalyticsInput({ event: "page_view" }), null);
  assert.equal(parseAnalyticsInput({ event: "vote_cast", countryCode: "CH" }), null);
  assert.equal(parseAnalyticsInput({ event: "analysis_failed", outcome: "contains personal text!" }), null);
});

test("the corpus plan covers 50 honest unmeasured cases across every pilot country and UI language", async () => {
  const plan = JSON.parse(await readFile(new URL("../evaluation/corpus-plan.json", import.meta.url), "utf8"));
  assert.equal(plan.cases.length, 50);
  assert.equal(plan.targetCount, 50);
  assert.deepEqual([...new Set(plan.cases.map((item) => item.country))].sort(), ["CA", "FR", "GB", "MX", "US"]);
  assert.deepEqual([...new Set(plan.cases.map((item) => item.language))].sort(), ["en-CA", "en-GB", "en-US", "es", "fr"]);
  for (const category of ["regional", "diaspora", "allergen_risk", "visually_similar", "low_quality", "non_food", "cross_language", "bilingual_menu"]) assert.ok(plan.cases.some((item) => item.category === category));
  assert.equal(plan.cases.some((item) => item.approved === true), false);
  assert.equal(plan.status, "awaiting_approved_images");
});

test("evaluation and feedback remain measured, consent-aware, localized, and available on web and iOS", async () => {
  // The web events are raised from the composer, the group surfaces and the
  // analytics hook, which together replaced the single root page component.
  const [analyticsRoute, analyticsLibrary, feedbackRoute, composer, matchTier, hook, plannerForm, planView, groupsPage, ios, harness] = await Promise.all([
    "../app/api/analytics/route.ts", "../lib/analytics.ts", "../app/api/feedback/route.ts",
    "../components/post/PostComposer.tsx", "../components/post/MatchTier.tsx", "../components/useAnalytics.ts",
    "../components/group/GroupPlannerForm.tsx", "../components/group/GroupPlanView.tsx", "../app/groups/page.tsx",
    "../ios/App.tsx", "../scripts/evaluate-identifier.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const web = [composer, matchTier, hook, plannerForm, planView, groupsPage].join("\n");
  assert.match(analyticsRoute, /recordConsentedAnalytics/);
  assert.match(analyticsLibrary, /analyticsConsent/);
  assert.match(feedbackRoute, /wrong_identification/);
  for (const event of ANALYTICS_EVENTS) { assert.match(web, new RegExp(event)); assert.match(ios, new RegExp(event)); }
  assert.match(ios, /JSON\.stringify\(\{ inviteCode, language \}\)/);
  for (const key of ["feedback.wrongIdentification", "feedback.staleDish", "feedback.closedRestaurant"]) { assert.match(web, new RegExp(key.replace(".", "\\."))); assert.match(ios, new RegExp(key.replace(".", "\\."))); }
  assert.match(harness, /status: "measured"/);
  assert.match(harness, /status: "unmeasured"/);
  assert.doesNotMatch(harness, /fabricat|mock score|placeholder score/i);
});

test("iOS release artifacts keep distribution, links, diagnostics, and access blockers explicit", async () => {
  const [eas, config, diagnostics, aasa, releaseDoc] = await Promise.all([
    "../ios/eas.json", "../ios/app.config.ts", "../app/api/diagnostics/route.ts", "../app/api/apple-app-site-association/route.ts", "../docs/ios-release-readiness.md",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const profiles = JSON.parse(eas).build;
  assert.equal(profiles.preview.distribution, "internal");
  assert.equal(profiles.production.distribution, "store");
  assert.equal(profiles.production.environment, "production");
  assert.match(config, /associatedDomains/);
  assert.match(diagnostics, /analyticsConsent/);
  assert.doesNotMatch(diagnostics, /request\.body|authorization|stack|image/i);
  assert.match(aasa, /APPLE_DEVELOPER_TEAM_ID/);
  assert.match(releaseDoc, /NO-GO/);
  assert.match(releaseDoc, /owner-only/);
});
