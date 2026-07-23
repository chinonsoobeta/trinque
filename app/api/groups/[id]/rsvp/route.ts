import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupRsvps, groups } from "@/db/schema";
import { groupMembership, groupSnapshot } from "@/lib/group-api";
import { AuthenticationError, requireOnboardedIdentity } from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let identity;
  try { identity = await requireOnboardedIdentity(request); }
  catch (error) { return Response.json({ error: error instanceof AuthenticationError ? error.message : "authentication_required" }, { status: error instanceof AuthenticationError ? error.status : 503 }); }
  const { id } = await params;
  const db = await getDb();
  const membership = await groupMembership(id, identity.id);
  const [plan] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!membership || !plan || plan.status !== "finalized") return Response.json({ error: "finalized_group_plan_not_found", code: "finalized_group_plan_not_found" }, { status: 404 });
  const { status } = await request.json() as { status?: "yes" | "maybe" | "no" };
  if (!status || !["yes", "maybe", "no"].includes(status)) return Response.json({ error: "valid_rsvp_required", code: "valid_rsvp_required" }, { status: 400 });
  await db.insert(groupRsvps).values({ groupId: id, userId: identity.id, status }).onConflictDoUpdate({ target: [groupRsvps.groupId, groupRsvps.userId], set: { status, updatedAt: new Date().toISOString() } });
  return Response.json({ group: await groupSnapshot(id, identity.id) });
}
