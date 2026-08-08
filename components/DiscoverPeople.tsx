"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppAvatar } from "@/components/AppPrimitives";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

type Suggested = { userId: string; displayName: string; handle: string; bio: string; avatarUrl: string | null; location: string | null; followerCount: number };

export function DiscoverPeople() {
  const { authHeaders, authenticated } = useAuth();
  const t = useUiText();
  const [profiles, setProfiles] = useState<Suggested[]>([]);
  useEffect(() => { void fetch("/api/profiles/suggested", { headers: authHeaders(), cache: "no-store" }).then((response) => response.json()).then((payload: { profiles?: Suggested[] }) => setProfiles(payload.profiles ?? [])).catch(() => undefined); }, [authHeaders, authenticated]);
  if (!profiles.length) return null;
  // These cards were a bare `<a>` around a name — no avatar, an 18px target,
  // and a full page load rather than a client navigation.
  return <section className="people-section">
    <div className="section-heading"><div><span className="kicker">{t("nav.explore")}</span><h2>{t("profile.findPeople")}</h2></div></div>
    <div className="profile-grid">{profiles.map((profile) => <article className="profile-card people-card" key={profile.userId}>
      <Link className="people-identity" href={`/profiles/${profile.handle}`}>
        <AppAvatar name={profile.displayName} src={profile.avatarUrl} size="medium" />
        <span><b>{profile.displayName}</b><small>@{profile.handle}</small></span>
      </Link>
      {profile.bio && <p className="people-bio">{profile.bio}</p>}
      <FollowButton handle={profile.handle} initialFollowing={false} initialCount={profile.followerCount} />
    </article>)}</div>
  </section>;
}
