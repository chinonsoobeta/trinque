"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingState, PageContainer } from "@/components/AppPrimitives";
import { GroupPlannerForm } from "@/components/group/GroupPlannerForm";
import type { GroupSnapshot } from "@/components/group/types";
import { useToast } from "@/components/ToastProvider";
import { useAnalytics } from "@/components/useAnalytics";
import { useUiLanguage, useUiText } from "@/components/useUiText";

/**
 * The entry point for group planning: joins an invite, resumes the plan already
 * in progress, or starts a new one. The plan itself lives at `/groups/[id]`.
 */
function Groups() {
  const router = useRouter();
  const params = useSearchParams();
  const { authenticated, authHeaders, loading, sessionToken } = useAuth();
  const { flash } = useToast();
  const track = useAnalytics();
  const t = useUiText();
  const language = useUiLanguage();

  const inviteCode = params.get("join");
  const editing = params.get("from");
  const [resolved, setResolved] = useState<{ group: GroupSnapshot | null } | null>(null);
  const joinAttempted = useRef(false);
  const ready = !loading && (!sessionToken || resolved !== null);

  useEffect(() => {
    if (loading || !sessionToken) return;
    let active = true;

    if (inviteCode && !joinAttempted.current) {
      joinAttempted.current = true;
      void fetch("/api/groups/join", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode, language }) })
        .then(async (response) => {
          if (!active) return;
          if (!response.ok) { flash(t("group.inviteInvalid")); setResolved({ group: null }); return; }
          const payload = await response.json() as { group: GroupSnapshot };
          track("invite_joined", { outcome: "success" });
          flash(t("group.joined"));
          router.replace(`/groups/${payload.group.id}`);
        })
        .catch(() => { if (active) { flash(t("error.generic")); setResolved({ group: null }); } });
      return () => { active = false; };
    }

    void fetch("/api/groups", { headers: authHeaders() })
      .then(async (response) => {
        if (!active) return;
        const group = response.ok ? ((await response.json()) as { group: GroupSnapshot | null }).group : null;
        // Editing an existing plan means prefilling the form, not resuming it.
        if (group && !editing) { router.replace(`/groups/${group.id}`); return; }
        setResolved({ group });
      })
      .catch(() => { if (active) setResolved({ group: null }); });
    return () => { active = false; };
  }, [authHeaders, editing, flash, inviteCode, language, loading, router, sessionToken, t, track]);

  if (!ready) return <LoadingState label={t("group.eyebrow")} />;
  if (!authenticated && inviteCode) return <EmptyState eyebrow={t("group.eyebrow")} title={t("group.createTitle")} body={t("auth.signInHelp")} action={<Link className="primary button-link" href={`/auth/login?context=group&next=${encodeURIComponent(`/groups?join=${inviteCode}`)}`}>{t("auth.signIn")}</Link>} />;
  return <GroupPlannerForm from={editing && resolved?.group?.id === editing ? resolved.group : null} />;
}

export default function GroupsPage() {
  return <PageContainer className="groups-page">
    <Suspense fallback={null}><Groups /></Suspense>
  </PageContainer>;
}
