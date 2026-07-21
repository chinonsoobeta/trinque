"use client";

import { useEffect, useState } from "react";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/components/AuthProvider";

type Suggested = { userId: string; displayName: string; handle: string; bio: string; avatarUrl: string | null; location: string | null; followerCount: number };

export function DiscoverPeople() {
  const { authHeaders, authenticated } = useAuth();
  const [profiles, setProfiles] = useState<Suggested[]>([]);
  useEffect(() => { void fetch("/api/profiles/suggested", { headers: authHeaders(), cache: "no-store" }).then((response) => response.json()).then((payload: { profiles?: Suggested[] }) => setProfiles(payload.profiles ?? [])).catch(() => undefined); }, [authHeaders, authenticated]);
  if (!profiles.length) return null;
  return <section><h2>Find people</h2><div className="profile-grid">{profiles.map((profile) => <article className="profile-card" key={profile.userId}><div><a href={`/profiles/${profile.handle}`}><b>{profile.displayName}</b></a><p>@{profile.handle}</p>{profile.bio && <p>{profile.bio}</p>}</div><FollowButton handle={profile.handle} initialFollowing={false} initialCount={profile.followerCount} /></article>)}</div></section>;
}
