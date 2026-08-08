"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";
import { AppAvatar } from "@/components/AppPrimitives";
import { Icon } from "@/components/Icon";
import { useUiText } from "@/components/useUiText";

/**
 * One navigation model for both breakpoints: Discover · Explore · Post ·
 * Groups · Profile, with Saved and Settings under Profile.
 *
 * Every destination is a real route. The shell used to switch four screens
 * inside `/` with custom window events and `history.pushState`, which meant
 * mobile could not reach Saved or Groups at all.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { authenticated, identity, loading, signOut } = useAuth();
  const t = useUiText();
  const [menuPathname, setMenuPathname] = useState<string | null>(null);
  const authSurface = pathname.startsWith("/auth/");
  const menuOpen = menuPathname === pathname;

  // The same three destinations the mobile bar carries as labelled tabs. Post is
  // the header call to action and Profile is the avatar, so both breakpoints
  // offer one identical set — Saved and Following hang off Profile on each.
  const desktopLinks = [
    { href: "/", label: t("nav.discover") },
    { href: "/explore", label: t("nav.explore") },
    { href: "/groups", label: t("nav.groups") },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuPathname(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  const active = (href: string) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  };
  const signInHref = `/auth/login?next=${encodeURIComponent(pathname || "/")}`;

  return <div className="global-app-shell">
    <header className={`app-header${authSurface ? " app-header-minimal" : ""}`}>
      <Link className="app-brand" href="/" aria-label={t("home.title")}><span>T</span><b>Trinque</b></Link>
      {!authSurface && <nav className="desktop-navigation" aria-label={t("nav.discover")}>
        {desktopLinks.map((item) => <Link key={item.label} href={item.href} className={active(item.href) ? "app-nav-link active" : "app-nav-link"}><span className="nav-label">{item.label}</span></Link>)}
      </nav>}
      <div className="app-header-actions">
        {!authSurface && <Link className="app-create-action" href="/post"><Icon name="post" size={18} /><span>{t("nav.postDish")}</span></Link>}
        {!authSurface && authenticated && <NotificationBell />}
        {!loading && !authenticated ? <Link className="signin-link" href={signInHref}>{t("auth.signIn")}</Link> : authenticated && identity ? <div className="profile-menu">
          <button className="profile-menu-trigger" onClick={() => setMenuPathname((value) => value === pathname ? null : pathname)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t("auth.openAccount")}><AppAvatar name={identity.displayName} size="small" /></button>
          {menuOpen && <div className="profile-menu-popover" role="menu">
            <div className="profile-menu-identity"><AppAvatar name={identity.displayName} size="medium" /><div><b>{identity.displayName}</b>{identity.email && <small>{identity.email}</small>}</div></div>
            <Link role="menuitem" href="/account">{t("auth.openAccount")}</Link>
            <Link role="menuitem" href="/saved">{t("nav.saved")}</Link>
            <Link role="menuitem" href="/explore?feed=following">{t("nav.following")}</Link>
            <Link role="menuitem" href="/settings">{t("settings.title")}</Link>
            <button role="menuitem" onClick={() => void signOut()}>{t("auth.signOut")}</button>
          </div>}
        </div> : null}
      </div>
    </header>
    <div className="app-content">{children}</div>
    {!authSurface && <nav className="mobile-navigation" aria-label={t("nav.discover")}>
      <Link href="/" className={active("/") ? "active" : ""}><Icon name="discover" size={22} /><small>{t("nav.discover")}</small></Link>
      <Link href="/explore" className={active("/explore") ? "active" : ""}><Icon name="explore" size={22} /><small>{t("nav.explore")}</small></Link>
      <Link href="/post" className="mobile-create" aria-label={t("nav.postDish")}><Icon name="post" size={24} /></Link>
      <Link href="/groups" className={active("/groups") ? "active" : ""}><Icon name="groups" size={22} /><small>{t("nav.groups")}</small></Link>
      <Link href={authenticated ? "/account" : signInHref} className={active("/account") ? "active" : ""}><Icon name="profile" size={22} /><small>{authenticated ? t("nav.profile") : t("auth.signIn")}</small></Link>
    </nav>}
  </div>;
}
