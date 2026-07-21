import { AppAvatar } from "@/components/AppPrimitives";

export type PublicProfile = {
  userId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  location: string | null;
  joinedAt: string;
};

export function ProfileCard({ profile, counts, action }: { profile: PublicProfile; counts: { followers: number; following: number; dishes: number }; action?: React.ReactNode }) {
  return <section className="profile-card profile-hero">
    <AppAvatar name={profile.displayName} src={profile.avatarUrl} size="large" />
    <div className="profile-identity"><span className="kicker">Profile</span><h1>{profile.displayName}</h1><p className="profile-handle">@{profile.handle}</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}{profile.location && <p className="profile-location">⌖ {profile.location}</p>}<div className="profile-stats"><span><b>{counts.dishes}</b><small>Dishes</small></span><span><b>{counts.followers}</b><small>Followers</small></span><span><b>{counts.following}</b><small>Following</small></span></div></div>
    <div className="profile-primary-action">{action}</div>
  </section>;
}
