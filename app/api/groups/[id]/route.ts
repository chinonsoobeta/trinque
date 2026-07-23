import { groupSnapshot } from "@/lib/group-api";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (!identity) return Response.json({ error: "authentication_required", code: "authentication_required" }, { status: 401 });
  const group = await groupSnapshot((await params).id, identity.id);
  return group ? Response.json({ group }) : Response.json({ error: "group_membership_required", code: "group_membership_required" }, { status: 404 });
}
