import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupCandidates, groups } from "@/db/schema";
import { groupSnapshot } from "@/lib/group-api";
import { rankGroupCandidates } from "@/lib/group-planning";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const db = await getDb();
  const [latest] = await db.select({ id: groups.id }).from(groups).where(eq(groups.ownerId, identity.id)).orderBy(desc(groups.createdAt)).limit(1);
  return Response.json({ group: latest ? await groupSnapshot(latest.id) : null });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "Guest session required." }, { status: 401 });
  const body = await request.json() as { name?: string; eventTime?: string; neighborhood?: string; budgetMax?: number; maxDistanceKm?: number; vegetarianRequired?: number; allergies?: string[] };
  const constraints = {
    budgetMax: clamp(Math.round(Number(body.budgetMax) || 35), 10, 150),
    maxDistanceKm: clamp(Math.round(Number(body.maxDistanceKm) || 4), 1, 30),
    vegetarianRequired: clamp(Math.round(Number(body.vegetarianRequired) || 0), 0, 20),
    allergies: (body.allergies ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 10),
  };
  const eventTime = new Date(body.eventTime ?? Date.now() + 86400000);
  if (Number.isNaN(eventTime.getTime())) return Response.json({ error: "Valid event time required." }, { status: 400 });
  const id = crypto.randomUUID();
  const db = await getDb();
  await db.insert(groups).values({ id, ownerId: identity.id, name: body.name?.trim().slice(0, 80) || "Friday supper", eventTime: eventTime.toISOString(), neighborhood: body.neighborhood?.trim().slice(0, 80) || "Mount Pleasant", ...constraints, allergies: JSON.stringify(constraints.allergies), inviteCode: crypto.randomUUID().replace(/-/g, "").slice(0, 10) });
  for (const candidate of rankGroupCandidates(constraints)) await db.insert(groupCandidates).values({ groupId: id, ...candidate, conflicts: JSON.stringify(candidate.conflicts) });
  return Response.json({ group: await groupSnapshot(id) }, { status: 201 });
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
