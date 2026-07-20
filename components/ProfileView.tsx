"use client";

import { useEffect, useState } from "react";
import { FollowButton } from "@/components/FollowButton";
import { ProfileCard, type PublicProfile } from "@/components/ProfileCard";
import { ProfileEditor } from "@/components/ProfileEditor";

type Dish = { id: string; name: string; cuisine: string; description: string; confidence: number; createdAt: string };
type Payload = { profile: PublicProfile; counts: { followers: number; following: number; dishes: number }; dishes: Dish[]; viewerFollowing: boolean; viewerIsOwner: boolean };

export function ProfileView({ handle }: { handle: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/profiles/${encodeURIComponent(handle)}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Profile not found."); return response.json() as Promise<Payload>; }).then(setPayload).catch((reason: Error) => setError(reason.message)); }, [handle]);
  if (error) return <main><h1>{error}</h1></main>;
  if (!payload) return <main><p>Loading profile…</p></main>;
  return <main className="profile-page"><ProfileCard profile={payload.profile} counts={payload.counts} action={payload.viewerIsOwner ? <ProfileEditor profile={payload.profile} /> : <FollowButton handle={payload.profile.handle} initialFollowing={payload.viewerFollowing} initialCount={payload.counts.followers} />} /><section><h2>Published dishes</h2>{payload.dishes.length ? <div className="dish-grid">{payload.dishes.map((dish) => <article className="dish-card" key={dish.id}><div className="dish-body"><h3>{dish.name}</h3><p>{dish.description}</p><small>{dish.cuisine} · {dish.confidence}% confidence</small></div></article>)}</div> : <p>No published dishes yet.</p>}</section></main>;
}
