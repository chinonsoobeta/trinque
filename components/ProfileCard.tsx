"use client";

import { AppAvatar } from "@/components/AppPrimitives";
import { useUiText } from "@/components/useUiText";

export type PublicProfile = { userId: string; displayName: string; handle: string; bio: string; avatarUrl: string | null; location: string | null; joinedAt: string };

export function ProfileCard({ profile, counts, action }: { profile: PublicProfile; counts: { followers: number; following: number; dishes: number }; action?: React.ReactNode }) {
  const t = useUiText();
  return <section className="profile-card profile-hero">
    <AppAvatar name={profile.displayName} src={profile.avatarUrl} size="large" />
    <div className="profile-identity"><span className="kicker">{t("nav.profile")}</span><h1>{profile.displayName}</h1><p className="profile-handle">@{profile.handle}</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}{profile.location && <p className="profile-location">⌖ {profile.location}</p>}<div className="profile-stats"><span><b>{counts.dishes}</b><small>{t("profile.dishes")}</small></span><span><b>{counts.followers}</b><small>{t("profile.followers")}</small></span><span><b>{counts.following}</b><small>{t("profile.following")}</small></span></div></div>
    <div className="profile-primary-action">{action}</div>
  </section>;
}
