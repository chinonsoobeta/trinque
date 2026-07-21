"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";
import { AppAvatar } from "@/components/AppPrimitives";

const desktopLinks = [
  { href: "/", label: "Discover" },
  { href: "/explore?feed=following", label: "Following" },
  { href: "/?view=groups", label: "Groups" },
  { href: "/?view=saved", label: "Saved" },
];

type RootView = "discover" | "groups" | "saved";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { authenticated, identity, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rootView, setRootView] = useState<RootView>("discover");
  const authSurface = pathname.startsWith("/auth/");

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const sync = () => {
      if (pathname !== "/") return;
      const requested = new URLSearchParams(window.location.search).get("view");
      setRootView(requested === "groups" || requested === "saved" ? requested : "discover");
    };
    sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  function createDish(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") return;
    event.preventDefault();
    window.dispatchEvent(new Event("trinque:create"));
  }

  function switchRootView(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (pathname !== "/" || !(href === "/" || href.startsWith("/?view="))) return;
    event.preventDefault();
    const requested = href === "/" ? "discover" : new URLSearchParams(href.slice(2)).get("view");
    const view: RootView = requested === "groups" || requested === "saved" ? requested : "discover";
    setRootView(view); window.history.pushState({}, "", href); window.dispatchEvent(new CustomEvent("trinque:view", { detail: view }));
  }

  const active = (href: string) => {
    if (pathname === "/" && href === "/") return rootView === "discover";
    if (pathname === "/" && href.startsWith("/?view=")) return href.includes(`view=${rootView}`);
    return !href.startsWith("/?") && href !== "/" && pathname.startsWith(href.split("?")[0]);
  };

  return <div className="global-app-shell">
    <header className={`app-header${authSurface ? " app-header-minimal" : ""}`}>
      <Link className="app-brand" href="/" onClick={(event) => switchRootView(event, "/")} aria-label="Trinque home"><span>T</span><b>Trinque</b></Link>
      {!authSurface && <nav className="desktop-navigation" aria-label="Primary navigation">
        {desktopLinks.map((item) => <Link key={item.label} href={item.href} onClick={(event) => switchRootView(event, item.href)} className={active(item.href) ? "app-nav-link active" : "app-nav-link"}><span className="nav-label">{item.label}</span></Link>)}
      </nav>}
      <div className="app-header-actions">
        {!authSurface && <Link className="header-search" href="/explore" aria-label="Explore dishes">⌕<span>Explore</span></Link>}
        {!authSurface && <Link className="app-create-action" href="/#capture" onClick={createDish}><span aria-hidden="true">＋</span><span>Post a dish</span></Link>}
        {!authSurface && authenticated && <NotificationBell />}
        {!loading && !authenticated ? <Link className="signin-link" href={`/auth/login?next=${encodeURIComponent(pathname || "/")}`}>Sign in</Link> : authenticated && identity ? <div className="profile-menu">
          <button className="profile-menu-trigger" onClick={() => setMenuOpen((value) => !value)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Open account menu for ${identity.displayName}`}><AppAvatar name={identity.displayName} size="small" /></button>
          {menuOpen && <div className="profile-menu-popover" role="menu"><div className="profile-menu-identity"><AppAvatar name={identity.displayName} size="medium" /><div><b>{identity.displayName}</b>{identity.email && <small>{identity.email}</small>}</div></div><Link role="menuitem" href="/account">Account & privacy</Link><Link role="menuitem" href="/explore?feed=following">Following feed</Link><button role="menuitem" onClick={() => void signOut()}>Sign out</button></div>}
        </div> : null}
      </div>
    </header>
    <div className="app-content">{children}</div>
    {!authSurface && <nav className="mobile-navigation" aria-label="Mobile navigation">
      <Link href="/" onClick={(event) => switchRootView(event, "/")} className={active("/") ? "active" : ""}><span aria-hidden="true">⌂</span><small>Discover</small></Link>
      <Link href="/explore" className={pathname.startsWith("/explore") ? "active" : ""}><span aria-hidden="true">⌕</span><small>Explore</small></Link>
      <Link href="/#capture" className="mobile-create" onClick={createDish} aria-label="Post a dish"><span aria-hidden="true">＋</span></Link>
      <Link href="/?view=groups" onClick={(event) => switchRootView(event, "/?view=groups")} className={active("/?view=groups") ? "active" : ""}><span aria-hidden="true">♢</span><small>Groups</small></Link>
      <Link href={authenticated ? "/account" : `/auth/login?next=${encodeURIComponent(pathname || "/")}`} className={pathname.startsWith("/account") ? "active" : ""}><span aria-hidden="true">○</span><small>{authenticated ? "Profile" : "Sign in"}</small></Link>
    </nav>}
  </div>;
}
