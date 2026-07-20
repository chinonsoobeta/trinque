"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LikeButton } from "@/components/LikeButton";

type FeedType = "following" | "trending";
type Dish = { id: string; name: string; cuisine: string; description: string; confidence: number; createdAt: string; contributorName?: string | null; contributorHandle?: string | null; likes24h?: number; comments24h?: number };

export function Feed({ type }: { type: FeedType }) {
  const { authenticated, authHeaders } = useAuth();
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
        if (!response.ok) throw new Error("Feed is temporarily unavailable.");
        const payload = await response.json() as { dishes: Dish[]; nextCursor?: string | null; nextOffset?: number | null };
        if (!active) return;
        setDishes(payload.dishes);
        setError("");
        if (type === "following") {
          setCursor(payload.nextCursor ?? null);
          setOffset(0);
          setDone(!payload.nextCursor);
        } else {
          setCursor(null);
          setOffset(payload.nextOffset ?? null);
          setDone(payload.nextOffset == null);
        }
        setLoadedKey(feedKey);
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        setDishes([]);
        setError(reason instanceof Error ? reason.message : "Feed is temporarily unavailable.");
        setDone(true);
        setLoadedKey(feedKey);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [authHeaders, authenticated, feedKey, type]);

  const loadMore = useCallback(async () => {
    if (loadingMore || done || loadedKey !== feedKey) return;
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (type === "following" && cursor) params.set("cursor", cursor);
      if (type === "trending" && offset) params.set("offset", String(offset));
      const response = await fetch(`/api/feed/${type === "following" ? "personal" : "trending"}?${params}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error("Feed is temporarily unavailable.");
      const payload = await response.json() as { dishes: Dish[]; nextCursor?: string | null; nextOffset?: number | null };
      setDishes((current) => {
        const map = new Map(current.map((dish) => [dish.id, dish]));
        for (const dish of payload.dishes) map.set(dish.id, dish);
        return [...map.values()];
      });
      if (type === "following") { setCursor(payload.nextCursor ?? null); setDone(!payload.nextCursor); }
      else { setOffset(payload.nextOffset ?? null); setDone(payload.nextOffset == null); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feed is temporarily unavailable.");
    } finally {
      setLoadingMore(false);
    }
  }, [authHeaders, cursor, done, feedKey, loadedKey, loadingMore, offset, type]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || initialLoading || done) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, initialLoading, loadMore]);

  if (type === "following" && !authenticated) return <div className="empty-state"><h3>Sign in for your following feed</h3><p>Trending discovery stays public.</p><a className="primary" href="/auth/login?next=/explore">Sign in</a></div>;
  if (initialLoading) return <section className="feed"><p>Loading…</p></section>;
  return <section className="feed">{dishes.length === 0 && !error && <div className="empty-state"><h3>{type === "following" ? "Your following feed is empty" : "No trending dishes yet"}</h3><p>{type === "following" ? "Follow a few contributors to personalize this feed." : "New engagement will surface dishes here."}</p></div>}{dishes.map((dish) => <article className="dish-card" key={dish.id}><div className="dish-body"><div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.description}</p></div><LikeButton dishId={dish.id} /></div><div className="dish-meta"><span>{dish.cuisine}</span>{dish.contributorHandle && <a href={`/profiles/${dish.contributorHandle}`}>@{dish.contributorHandle}</a>}</div>{type === "trending" && <small>{dish.likes24h ?? 0} likes · {dish.comments24h ?? 0} comments in 24h</small>}</div></article>)}{error && <div role="alert"><p>{error}</p><button onClick={() => void loadMore()}>Try again</button></div>}{loadingMore && <p>Loading…</p>}<div ref={sentinel} aria-hidden="true" /></section>;
}
