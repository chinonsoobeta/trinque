"use client";

import { use } from "react";
import { PageContainer } from "@/components/AppPrimitives";
import { GroupPlanView } from "@/components/group/GroupPlanView";

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PageContainer className="groups-page"><GroupPlanView groupId={id} /></PageContainer>;
}
