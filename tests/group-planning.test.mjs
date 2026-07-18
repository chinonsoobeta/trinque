import assert from "node:assert/strict";
import test from "node:test";
import { calendarDocument, rankGroupCandidates, selectGroupWinner } from "../lib/group-planning.ts";

test("group ranking excludes hard conflicts and explains them", () => {
  const candidates = rankGroupCandidates({ budgetMax: 25, maxDistanceKm: 4, vegetarianRequired: 1, allergies: ["sesame"] });
  assert.equal(candidates[0].eligible, true);
  const cauliflower = candidates.find((candidate) => candidate.candidateId === "susu-cauliflower");
  assert.equal(cauliflower.eligible, false);
  assert.match(cauliflower.conflicts.join(" "), /sesame/i);
  const cod = candidates.find((candidate) => candidate.candidateId === "kissa-cod");
  assert.match(cod.conflicts.join(" "), /vegetarian/i);
});

test("votes win among eligible candidates and score breaks ties", () => {
  const candidates = rankGroupCandidates({ budgetMax: 35, maxDistanceKm: 4, vegetarianRequired: 1, allergies: [] });
  const eligible = candidates.filter((candidate) => candidate.eligible);
  const winner = selectGroupWinner(candidates, { [eligible[1].candidateId]: 3, [eligible[0].candidateId]: 1 });
  assert.equal(winner.candidateId, eligible[1].candidateId);
  assert.equal(selectGroupWinner(candidates, {}).candidateId, eligible[0].candidateId);
});

test("final plans export a valid calendar event", () => {
  const calendar = calendarDocument({ name: "Friday supper", eventTime: "2026-07-18T02:30:00.000Z", restaurant: "Oca Pastificio", neighborhood: "Mount Pleasant", description: "A strong group fit" });
  assert.match(calendar, /^BEGIN:VCALENDAR/);
  assert.match(calendar, /DTSTART:20260718T023000Z/);
  assert.match(calendar, /LOCATION:Oca Pastificio\\, Mount Pleasant/);
  assert.match(calendar, /END:VCALENDAR/);
});
