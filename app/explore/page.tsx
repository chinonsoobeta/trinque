"use client";

import { useState } from "react";
import { DiscoverPeople } from "@/components/DiscoverPeople";
import { Feed } from "@/components/Feed";

export default function ExplorePage() {
  const [feed, setFeed] = useState<"trending" | "following">("trending");
  return <main className="explore-page"><header className="explore-hero"><span className="kicker">The community table</span><h1>Find the dish worth leaving home for.</h1><p>Real finds from people who care about what is on the plate. Browse what is gathering attention, or keep up with the tastes you follow.</p><div className="filters" role="tablist" aria-label="Choose a feed"><button role="tab" aria-selected={feed === "trending"} className={feed === "trending" ? "active" : ""} onClick={() => setFeed("trending")}>Trending now</button><button role="tab" aria-selected={feed === "following"} className={feed === "following" ? "active" : ""} onClick={() => setFeed("following")}>Following</button></div></header><div className="explore-layout"><div><Feed type={feed} /></div><aside className="people-rail"><span className="kicker">Taste to trust</span><DiscoverPeople /></aside></div></main>;
}
