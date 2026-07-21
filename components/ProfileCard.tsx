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
  return <section className="profile-card">
    <div className="profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.displayName.slice(0, 2).toUpperCase()}</span>}</div>
    <div><span className="profile-handle">@{profile.handle}</span><h1>{profile.displayName}</h1>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p>{profile.location}</p>}<p><b>{counts.followers}</b> followers · <b>{counts.following}</b> following · <b>{counts.dishes}</b> dishes</p></div>
    {action}
  </section>;
}
