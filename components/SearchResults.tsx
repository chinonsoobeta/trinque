"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppAvatar, EmptyState, LoadingState } from "@/components/AppPrimitives";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/components/AuthProvider";
import { SocialDishCard, type SocialDish } from "@/components/SocialDishCard";
import { useUiText } from "@/components/useUiText";
import type { MessageKey } from "@/ios/i18n";

type Person = { userId: string; displayName: string; handle: string; bio: string; avatarUrl: string | null; followerCount: number };
type Results = { dishes: SocialDish[]; profiles: Person[] };

/**
 * What a query found, in the same cards the rest of the app uses: dishes as
 * feed cards, people as the suggestion cards from Explore.
 */
export function SearchResults({ query }: { query: string }) {
  const { authHeaders } = useAuth();
  const t = useUiText();
  // What was answered, and for which query. Holding the query alongside the
  // answer is what makes "still loading" a comparison rather than a third piece
  // of state an effect has to remember to set and unset.
  const [answered, setAnswered] = useState<{ query: string; results: Results | null; errorKey: MessageKey | null }>({ query: "", results: null, errorKey: null });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: authHeaders(), cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("search.failed");
        const payload = await response.json() as Results;
        if (active) setAnswered({ query, results: payload, errorKey: null });
      } catch {
        if (!active || controller.signal.aborted) return;
        setAnswered({ query, results: null, errorKey: "search.failed" });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [authHeaders, query]);

  if (answered.query !== query) return <LoadingState label={t("search.searching")} />;
  if (answered.errorKey) return <p className="feed-error" role="alert">{t(answered.errorKey)}</p>;
  const dishes = answered.results?.dishes ?? [];
  const people = answered.results?.profiles ?? [];
  if (!dishes.length && !people.length) return <EmptyState eyebrow={t("search.label")} title={t("search.noResults", { query })} body={t("search.noResultsHelp")} />;

  return <div className="search-results">
    {/* The query rather than counts: "1 dishes and 0 people" needs plural
        agreement in eight languages to say nothing the sections below don't. */}
    <p className="search-count" role="status">{t("search.found", { query })}</p>
    {dishes.length > 0 && <section className="feed social-feed">{dishes.map((dish) => <SocialDishCard key={dish.id} dish={dish} />)}</section>}
    {people.length > 0 && <section className="people-section">
      <div className="section-heading"><div><span className="kicker">{t("search.label")}</span><h2>{t("profile.findPeople")}</h2></div></div>
      <div className="profile-grid">{people.map((person) => <article className="profile-card people-card" key={person.userId}>
        <Link className="people-identity" href={`/profiles/${person.handle}`}>
          <AppAvatar name={person.displayName} src={person.avatarUrl} size="medium" />
          <span><b>{person.displayName}</b><small>@{person.handle}</small></span>
        </Link>
        {person.bio && <p className="people-bio">{person.bio}</p>}
        <FollowButton handle={person.handle} initialFollowing={false} initialCount={person.followerCount} />
      </article>)}</div>
    </section>}
  </div>;
}
