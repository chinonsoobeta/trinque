"use client";

import { useEffect, useState } from "react";
import { FollowButton } from "@/components/FollowButton";
import { ProfileCard, type PublicProfile } from "@/components/ProfileCard";
import { ProfileEditor } from "@/components/ProfileEditor";

type Dish = { id: string; name: string; cuisine: string; description: string; confidence: number; createdAt: string; imageUrl?: string | null };
type Payload = { profile: PublicProfile; counts: { followers: number; following: number; dishes: number }; dishes: Dish[]; viewerFollowing: boolean; viewerIsOwner: boolean };

export function ProfileView({ handle }: { handle: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/profiles/${encodeURIComponent(handle)}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Profile not found."); return response.json() as Promise<Payload>; }).then(setPayload).catch((reason: Error) => setError(reason.message)); }, [handle]);
  if (error) return <main><h1>{error}</h1></main>;
  if (!payload) return <main><p>Loading profile…</p></main>;
  return <main className="profile-page"><ProfileCard profile={payload.profile} counts={payload.counts} action={payload.viewerIsOwner ? <ProfileEditor profile={payload.profile} /> : <FollowButton handle={payload.profile.handle} initialFollowing={payload.viewerFollowing} initialCount={payload.counts.followers} />} /><section><span className="kicker">Their table</span><h2>Published dishes</h2>{payload.dishes.length ? <div className="dish-grid">{payload.dishes.map((dish) => <a className="dish-card" href={`/dishes/${dish.id}`} key={dish.id}>{dish.imageUrl && <div className="dish-image" style={{ backgroundImage: `url(${dish.imageUrl})` }} />}<div className="dish-body"><span className="kicker">{dish.cuisine}</span><h3>{dish.name}</h3><p>{dish.description}</p></div></a>)}</div> : <div className="empty-state"><span className="empty-kicker">Nothing plated yet</span><h3>No published dishes</h3><p>When {payload.profile.displayName} shares a find, it will appear here.</p></div>}</section></main>;
}
