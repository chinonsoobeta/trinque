"use client";

import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { AccountPrivacyActions } from "@/components/AccountPrivacyActions";
import { useAuth } from "@/components/AuthProvider";

export function AuthControls() {
  const { authenticated, identity, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (loading) return <p className="privacy-note">Checking sign-in…</p>;
  if (authenticated) return <div className="setting-block"><span>Account</span><p className="privacy-note">Signed in as {identity?.displayName}</p><AccountPrivacyActions /><button className="text-button full" onClick={() => void signOut()}>Sign out</button></div>;
  return <div className="setting-block"><span>Account</span><p className="privacy-note">Guest browsing is available. Sign in for saves, publishing, groups, and social actions.</p><button className="secondary full" onClick={() => setOpen(true)}>Sign in or create account</button><AuthModal open={open} onClose={() => setOpen(false)} /></div>;
}
