"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Home, Plus, Search, UserRound, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { NotificationBell } from "@/components/NotificationBell";

const links = [
  { href: "/", label: "Discover", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/?view=groups", label: "Groups", icon: Users },
  { href: "/?view=saved", label: "Saved", icon: Bookmark },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authenticated, identity } = useAuth();
  if (pathname === "/") return children;
  const profileHref = authenticated && identity?.handle ? `/profiles/${identity.handle}` : "/auth/login";

  return <div className="site-frame">
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="Trinque home"><span aria-hidden="true">T</span><b>Trinque</b></Link>
      <nav className="site-nav" aria-label="Primary navigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={label} href={href} className={pathname === href ? "active" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
      <div className="site-actions">
        <Link className="icon-action search-action" href="/explore" aria-label="Search dishes and people"><Search aria-hidden="true" /></Link>
        <NotificationBell />
        <Link className="profile-action" href={profileHref}><UserRound aria-hidden="true" /><span>{authenticated ? identity?.displayName ?? "Profile" : "Sign in"}</span></Link>
      </div>
    </header>
    <div className="site-content">{children}</div>
    <nav className="site-mobile-nav" aria-label="Mobile navigation">
      {links.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={label} href={href} className={pathname === href ? "active" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      <Link className="create-action" href="/?create=1" aria-label="Share a dish"><Plus aria-hidden="true" /></Link>
      {links.slice(2).map(({ href, label, icon: Icon }) => <Link key={label} href={href}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
