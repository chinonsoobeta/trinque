"use client";

import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { PageContainer } from "@/components/AppPrimitives";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
  const { authenticated, identity, loading } = useAuth();
  return <PageContainer className="account-page">
    <header className="page-hero compact"><span className="kicker">Your Trinque</span><h1>Your account and privacy.</h1><p>Change your profile, app choices, and privacy choices here.</p></header>
    <div className="account-grid">
      <section className="account-card"><span className="kicker">Profile</span><h2>{loading ? "Loading…" : authenticated ? identity?.displayName : "Guest"}</h2><p>Other people can see your public profile. You can edit it from your profile page.</p><Link className="secondary button-link" href="/explore">Find people</Link></section>
      <section className="account-card"><span className="kicker">App choices</span><h2>Language, look, units, and location</h2><p>Trinque uses only your rough area to find food near you and plan meals.</p><Link className="secondary button-link" href="/?settings=1">Open settings</Link></section>
      <section className="account-card account-card-wide"><span className="kicker">Account and data</span><AuthControls /></section>
    </div>
  </PageContainer>;
}
