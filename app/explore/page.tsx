"use client";

import { useState } from "react";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { Feed } from "@/components/Feed";

export default function ExplorePage() {
  const [feed, setFeed] = useState<"trending" | "following">("trending");
  return <main className="explore-page"><header><h1>Explore Trinque</h1><p>Trending is public. Following becomes personal when you sign in.</p><div className="filters"><button className={feed === "trending" ? "active" : ""} onClick={() => setFeed("trending")}>Trending</button><button className={feed === "following" ? "active" : ""} onClick={() => setFeed("following")}>Following</button></div></header><Feed type={feed} /><DiscoverPeople /></main>;
}
