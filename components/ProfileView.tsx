"use client";

import { useEffect, useState } from "react";
import { FollowButton } from "@/components/FollowButton";
import { ProfileCard, type PublicProfile } from "@/components/ProfileCard";
import { ProfileEditor } from "@/components/ProfileEditor";
import { EmptyState, LoadingState, PageContainer } from "@/components/AppPrimitives";
import { SocialDishCard, type SocialDish } from "@/components/SocialDishCard";
import { useAuth } from "@/components/AuthProvider";

type Dish = SocialDish & { confidence: number; createdAt: string };
type Payload = { profile: PublicProfile; counts: { followers: number; following: number; dishes: number }; dishes: Dish[]; viewerFollowing: boolean; viewerIsOwner: boolean };

export function ProfileView({ handle }: { handle: string }) {
  const { authHeaders } = useAuth();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void fetch(`/api/profiles/${encodeURIComponent(handle)}`, { headers: authHeaders(), cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Profile not found."); return response.json() as Promise<Payload>; }).then((value) => { if (active) { setPayload(value); setError(""); } }).catch((reason: Error) => { if (active) setError(reason.message); }); return () => { active = false; }; }, [authHeaders, handle]);
  if (error) return <PageContainer className="profile-page"><EmptyState eyebrow="Profile" title={error} body="This profile may no longer be public." action={<a className="secondary button-link" href="/explore">Back to Explore</a>} /></PageContainer>;
  if (!payload) return <PageContainer className="profile-page"><LoadingState label="Loading profile…" /></PageContainer>;
  return <PageContainer className="profile-page"><ProfileCard profile={payload.profile} counts={payload.counts} action={payload.viewerIsOwner ? <ProfileEditor profile={payload.profile} /> : <FollowButton handle={payload.profile.handle} initialFollowing={payload.viewerFollowing} initialCount={payload.counts.followers} />} /><section className="profile-dishes"><div className="section-heading"><div><span className="kicker">Their dishes</span><h2>Posted dishes</h2></div></div>{payload.dishes.length ? <div className="profile-dish-grid">{payload.dishes.map((dish) => <SocialDishCard key={dish.id} dish={{ ...dish, contributorName: payload.profile.displayName, contributorHandle: payload.profile.handle, contributorAvatarUrl: payload.profile.avatarUrl }} />)}</div> : <EmptyState title="No posted dishes yet." body="Posted dishes will show here." />}</section></PageContainer>;
}
