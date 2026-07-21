"use client";

import { useState } from "react";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { Feed } from "@/components/Feed";
import { PageContainer } from "@/components/AppPrimitives";

export default function ExplorePage() {
  const [feed, setFeed] = useState<"trending" | "following">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("feed") === "following"
      ? "following"
      : "trending",
  );
  function selectFeed(next: "trending" | "following") {
    setFeed(next);
    const url = new URL(window.location.href);
    if (next === "following") url.searchParams.set("feed", "following"); else url.searchParams.delete("feed");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  return <PageContainer className="explore-page"><header className="page-hero compact"><span className="kicker">Find dishes</span><h1>See what people are eating.</h1><p>Anyone can see Top dishes. Sign in and follow people to see their new dishes here.</p><div className="filters" role="tablist" aria-label="Dish feeds"><button role="tab" aria-selected={feed === "trending"} className={feed === "trending" ? "active" : ""} onClick={() => selectFeed("trending")}>Top dishes</button><button role="tab" aria-selected={feed === "following"} className={feed === "following" ? "active" : ""} onClick={() => selectFeed("following")}>Following</button></div></header><Feed type={feed} /><DiscoverPeople /></PageContainer>;
}
