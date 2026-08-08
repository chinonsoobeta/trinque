"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingState, PageContainer } from "@/components/AppPrimitives";
import { SocialDishCard, type SocialDish } from "@/components/SocialDishCard";
import { useUiText } from "@/components/useUiText";

type SavedResponse = { savedDishIds: number[]; dishes?: SocialDish[] };

/**
 * Saved dishes, from `/api/saves` rather than a local `Set` over a demo array.
 *
 * The endpoint still answers with numeric ids from an older schema, so it
 * returns dishes only once the saves table can reference a published dish —
 * until then this renders the empty state rather than inventing content.
 */
export default function SavedPage() {
  const { authenticated, authHeaders, loading } = useAuth();
  const t = useUiText();
  const [dishes, setDishes] = useState<SocialDish[] | null>(null);
  const ready = !loading && (!authenticated || dishes !== null);

  useEffect(() => {
    if (loading || !authenticated) return;
    let active = true;
    void fetch("/api/saves", { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as SavedResponse : null)
      .then((payload) => { if (active) setDishes(payload?.dishes ?? []); })
      .catch(() => { if (active) setDishes([]); });
    return () => { active = false; };
  }, [authHeaders, authenticated, loading]);

  return <PageContainer className="saved-page">
    <header className="page-hero compact">
      <span className="kicker">{t("nav.saved")}</span>
      <h1>{t("home.savedTitle")}</h1>
      <p>{t("home.savedBody")}</p>
    </header>
    {!ready ? <LoadingState label={t("feed.loading")} />
      : !authenticated ? <EmptyState eyebrow={t("nav.saved")} title={t("auth.signIn")} body={t("auth.signInBody")} action={<Link className="primary button-link" href="/auth/login?context=save&next=%2Fsaved">{t("auth.signIn")}</Link>} />
      : !dishes?.length ? <EmptyState eyebrow={t("nav.saved")} title={t("home.emptyTitle")} body={t("home.emptyBody")} action={<Link className="secondary button-link" href="/">{t("home.explore")}</Link>} />
      : <section className="feed social-feed">{dishes.map((dish) => <SocialDishCard key={dish.id} dish={dish} />)}</section>}
  </PageContainer>;
}
