"use client";

import { useState } from "react";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { Feed } from "@/components/Feed";
import { PageContainer } from "@/components/AppPrimitives";
import { useUiText } from "@/components/useUiText";

export default function ExplorePage() {
  const t = useUiText();
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
  return <PageContainer className="explore-page"><header className="page-hero compact"><span className="kicker">{t("home.eyebrow")}</span><h1>{t("feed.title")}</h1><p>{t("auth.signInHelp")}</p><div className="filters" role="tablist" aria-label={t("home.explore")}><button role="tab" aria-selected={feed === "trending"} className={feed === "trending" ? "active" : ""} onClick={() => selectFeed("trending")}>{t("feed.top")}</button><button role="tab" aria-selected={feed === "following"} className={feed === "following" ? "active" : ""} onClick={() => selectFeed("following")}>{t("nav.following")}</button></div></header><Feed type={feed} /><DiscoverPeople /></PageContainer>;
}
