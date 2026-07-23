import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "authentication_required", code: "authentication_required" }, { status: 401 });
  const id = (await params).id;
  const db = await getDb();
  const [owned] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.id, id), eq(groups.ownerId, identity.id))).limit(1);
  if (!owned) return Response.json({ error: "group_owner_required", code: "group_owner_required" }, { status: 403 });
  await db.update(groups).set({ inviteRevokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(groups.id, id));
  return Response.json({ group: await groupSnapshot(id, identity.id) });
}
