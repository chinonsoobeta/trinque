"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingState } from "@/components/AppPrimitives";
import { SocialDishCard, type SocialDish } from "@/components/SocialDishCard";
import { useUiText } from "@/components/useUiText";

type FeedType = "following" | "trending";
type Dish = SocialDish & { confidence: number; createdAt: string; likes24h?: number; comments24h?: number };

export function Feed({ type }: { type: FeedType }) {
  const { authenticated, authHeaders } = useAuth();
  const t = useUiText();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [offset, setOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const feedKey = `${type}:${authenticated ? "authenticated" : "anonymous"}`;
  const initialLoading = type !== "following" || authenticated ? loadedKey !== feedKey : false;

  useEffect(() => {
    if (type === "following" && !authenticated) return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        const response = await fetch(`/api/feed/${type === "following" ? "personal" : "trending"}?${params}`, { headers: authHeaders(), cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(t("feed.failed"));
        const payload = await response.json() as { dishes: Dish[]; nextCursor?: string | null; nextOffset?: number | null };
        if (!active) return;
        setDishes(payload.dishes);
        setError("");
        if (type === "following") { setCursor(payload.nextCursor ?? null); setOffset(0); setDone(!payload.nextCursor); }
        else { setCursor(null); setOffset(payload.nextOffset ?? null); setDone(payload.nextOffset == null); }
        setLoadedKey(feedKey);
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        setDishes([]);
        setError(reason instanceof Error ? reason.message : t("feed.failed"));
        setDone(true);
        setLoadedKey(feedKey);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [authHeaders, authenticated, feedKey, t, type]);

  const loadMore = useCallback(async () => {
    if (loadingMore || done || loadedKey !== feedKey) return;
    setLoadingMore(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (type === "following" && cursor) params.set("cursor", cursor);
      if (type === "trending" && offset) params.set("offset", String(offset));
      const response = await fetch(`/api/feed/${type === "following" ? "personal" : "trending"}?${params}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(t("feed.failed"));
      const payload = await response.json() as { dishes: Dish[]; nextCursor?: string | null; nextOffset?: number | null };
      setDishes((current) => { const map = new Map(current.map((dish) => [dish.id, dish])); for (const dish of payload.dishes) map.set(dish.id, dish); return [...map.values()]; });
      if (type === "following") { setCursor(payload.nextCursor ?? null); setDone(!payload.nextCursor); }
      else { setOffset(payload.nextOffset ?? null); setDone(payload.nextOffset == null); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("feed.failed")); }
    finally { setLoadingMore(false); }
  }, [authHeaders, cursor, done, feedKey, loadedKey, loadingMore, offset, t, type]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || initialLoading || done) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadMore(); }, { rootMargin: "400px" });
    observer.observe(node); return () => observer.disconnect();
  }, [done, initialLoading, loadMore]);

  if (type === "following" && !authenticated) return <EmptyState eyebrow={t("nav.following")} title={t("feed.followHelp")} body={t("auth.signInHelp")} action={<a className="primary button-link" href="/auth/login?next=/explore%3Ffeed%3Dfollowing">{t("auth.signIn")}</a>} />;
  if (initialLoading) return <section className="feed"><LoadingState label={t("feed.loading")} /></section>;
  return <section className="feed social-feed">
    {dishes.length === 0 && !error && <EmptyState eyebrow={t(type === "following" ? "nav.following" : "feed.top")} title={t(type === "following" ? "feed.followEmpty" : "feed.publicEmpty")} body={t(type === "following" ? "feed.followHelp" : "feed.publicEmptyHelp")} action={type === "following" ? <a className="secondary button-link" href="/explore">{t("profile.findPeople")}</a> : undefined} />}
    {dishes.map((dish) => <SocialDishCard key={dish.id} dish={dish} engagementLabel={type === "trending" ? `${dish.likes24h ?? 0} likes · ${dish.comments24h ?? 0} comments in the previous 24 hours` : undefined} />)}
    {error && <div className="feed-error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void loadMore()}>{t("action.tryAgain")}</button></div>}
    {loadingMore && <LoadingState label={t("feed.loadingMore")} />}<div ref={sentinel} aria-hidden="true" />
  </section>;
}
