"use client";

import Link from "next/link";
import { AccountPrivacyActions } from "@/components/AccountPrivacyActions";
import { useAuth } from "@/components/AuthProvider";

export function AuthControls() {
  const { authenticated, identity, loading, signOut } = useAuth();
  if (loading) return <p className="privacy-note" role="status">Checking sign-in…</p>;
  if (authenticated) return <div className="setting-block account-block"><span>Account</span><p className="privacy-note">Signed in as <b>{identity?.displayName}</b>{identity?.email ? ` · ${identity.email}` : ""}</p><Link className="secondary full button-link" href="/account">Open account and privacy</Link><AccountPrivacyActions /><button className="text-button full" onClick={() => void signOut()}>Sign out</button></div>;
  return <div className="setting-block account-block"><span>Account</span><p className="privacy-note">Anyone can browse. Sign in to save, post, follow, comment, or plan a meal with a group.</p><Link className="secondary full button-link" href="/auth/login?next=/">Sign in or make an account</Link></div>;
}
