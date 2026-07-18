import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("group routes enforce membership, independent writes, and owner-only finalization", async () => {
  const [read, vote, rsvp, finalize, calendar] = await Promise.all([
    source("../app/api/groups/[id]/route.ts"),
    source("../app/api/groups/[id]/vote/route.ts"),
    source("../app/api/groups/[id]/rsvp/route.ts"),
    source("../app/api/groups/[id]/finalize/route.ts"),
    source("../app/api/groups/[id]/calendar/route.ts"),
  ]);
  assert.match(read, /groupSnapshot\([^,]+, identity\.id\)/);
  assert.match(vote, /groupMembership\(id, identity\.id\)/);
  assert.match(vote, /target: \[groupVotes\.groupId, groupVotes\.userId\]/);
  assert.match(rsvp, /groupMembership\(id, identity\.id\)/);
  assert.match(rsvp, /target: \[groupRsvps\.groupId, groupRsvps\.userId\]/);
  assert.match(finalize, /eq\(groups\.ownerId, identity\.id\)/);
  assert.match(finalize, /selectGroupWinner/);
  assert.match(calendar, /timeZone: group\.timeZone/);
});

test("invite joining requires an unexpired, unrevoked code", async () => {
  const [join, revoke] = await Promise.all([
    source("../app/api/groups/join/route.ts"),
    source("../app/api/groups/[id]/invite/revoke/route.ts"),
  ]);
  assert.match(join, /isNull\(groups\.inviteRevokedAt\)/);
  assert.match(join, /gt\(groups\.inviteExpiresAt/);
  assert.match(join, /role: group\.ownerId === identity\.id \? "owner" : "participant"/);
  assert.match(revoke, /eq\(groups\.ownerId, identity\.id\)/);
});
