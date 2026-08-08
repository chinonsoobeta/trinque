"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { Feed } from "@/components/Feed";
import { Icon } from "@/components/Icon";
import { SearchResults } from "@/components/SearchResults";
import { LoadingState, PageContainer } from "@/components/AppPrimitives";
import { useUiText } from "@/components/useUiText";

export default function ExplorePage() {
  return <Suspense fallback={<PageContainer className="explore-page"><LoadingState label="…" /></PageContainer>}><ExploreContent /></Suspense>;
}

/**
 * Explore is where you look something up. It offered trending and following but
 * nothing to type into, so reaching a particular dish or person meant already
 * knowing the URL.
 */
function ExploreContent() {
  const t = useUiText();
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const feed: "trending" | "following" = params.get("feed") === "following" ? "following" : "trending";
  const [draft, setDraft] = useState(query);
  // The field follows the URL, so the back button and a shared link both put the
  // right words in the box rather than leaving it empty over someone's results.
  // Adjusted during render rather than in an effect: an effect would paint the
  // stale text first and then correct it.
  const [shownQuery, setShownQuery] = useState(query);
  if (shownQuery !== query) { setShownQuery(query); setDraft(query); }

  function go(next: { q?: string; feed?: "trending" | "following" }) {
    const url = new URLSearchParams(params.toString());
    if (next.q !== undefined) { if (next.q) url.set("q", next.q); else url.delete("q"); }
    if (next.feed !== undefined) { if (next.feed === "following") url.set("feed", "following"); else url.delete("feed"); }
    const search = url.toString();
    router.replace(search ? `/explore?${search}` : "/explore", { scroll: false });
  }

  return <PageContainer className="explore-page">
    <header className="page-hero compact">
      <span className="kicker">{t("home.eyebrow")}</span>
      <h1>{t("feed.title")}</h1>
      <p>{t("auth.signInHelp")}</p>
      <form className="search-bar" role="search" onSubmit={(event: FormEvent) => { event.preventDefault(); go({ q: draft.trim() }); }}>
        <Icon name="explore" size={18} />
        {/* Enter searches. Implicit form submission did not fire from this
            field, and a search box that ignores the return key is broken no
            matter how good the button next to it looks. Preventing the default
            means this runs once, not once per path. */}
        <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); go({ q: draft.trim() }); } }}
          placeholder={t("search.placeholder")} aria-label={t("search.label")} />
        {query ? <button type="button" className="text-button" onClick={() => { setDraft(""); go({ q: "" }); }}>{t("search.clear")}</button> : null}
        <button className="primary">{t("search.action")}</button>
      </form>
      {!query && <div className="filters" role="tablist" aria-label={t("home.explore")}>
        <button role="tab" aria-selected={feed === "trending"} className={feed === "trending" ? "active" : ""} onClick={() => go({ feed: "trending" })}>{t("feed.top")}</button>
        <button role="tab" aria-selected={feed === "following"} className={feed === "following" ? "active" : ""} onClick={() => go({ feed: "following" })}>{t("nav.following")}</button>
      </div>}
    </header>
    {query ? <SearchResults query={query} /> : <><Feed type={feed} /><DiscoverPeople /></>}
  </PageContainer>;
}
