"use client";

import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { PageContainer } from "@/components/AppPrimitives";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
  const { authenticated, identity, loading } = useAuth();
  return <PageContainer className="account-page">
    <header className="page-hero compact"><span className="kicker">Your Trinque</span><h1>Account, preferences & privacy.</h1><p>Public profile identity, sign-in, app preferences, and privacy controls are intentionally separated so each choice is clear.</p></header>
    <div className="account-grid">
      <section className="account-card"><span className="kicker">Profile</span><h2>{loading ? "Loading…" : authenticated ? identity?.displayName : "Browsing as a guest"}</h2><p>Your public profile is your social identity. Profile editing remains attached to your public profile surface.</p><Link className="secondary button-link" href="/explore">Discover contributors</Link></section>
      <section className="account-card"><span className="kicker">Preferences</span><h2>Language, theme, units & location</h2><p>Location stays coarse and is used only for nearby discovery and planning.</p><Link className="secondary button-link" href="/?settings=1">Open preferences</Link></section>
      <section className="account-card account-card-wide"><span className="kicker">Account & privacy data</span><AuthControls /></section>
    </div>
  </PageContainer>;
}
