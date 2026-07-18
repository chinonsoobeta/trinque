import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupRsvps, groups } from "@/db/schema";
import { groupMembership, groupSnapshot } from "@/lib/group-api";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const membership = await groupMembership(id, identity.id);
  const [plan] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!membership || !plan || plan.status !== "finalized") return Response.json({ error: "Finalized group plan not found." }, { status: 404 });
  const { status } = await request.json() as { status?: "yes" | "maybe" | "no" };
  if (!status || !["yes", "maybe", "no"].includes(status)) return Response.json({ error: "Valid RSVP required." }, { status: 400 });
  await db.insert(groupRsvps).values({ groupId: id, userId: identity.id, status }).onConflictDoUpdate({ target: [groupRsvps.groupId, groupRsvps.userId], set: { status, updatedAt: new Date().toISOString() } });
  return Response.json({ group: await groupSnapshot(id, identity.id) });
}
