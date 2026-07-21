"use client";

import Link from "next/link";
import { AccountPrivacyActions } from "@/components/AccountPrivacyActions";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export function AuthControls() {
  const { authenticated, identity, loading, signOut } = useAuth();
  const t = useUiText();
  if (loading) return <p className="privacy-note" role="status">{t("auth.checking")}</p>;
  if (authenticated) return <div className="setting-block account-block"><span>{t("auth.account")}</span><p className="privacy-note">{t("auth.signedIn", { name: identity?.displayName ?? "" })}{identity?.email ? ` · ${identity.email}` : ""}</p><Link className="secondary full button-link" href="/account">{t("auth.openAccount")}</Link><AccountPrivacyActions /><button className="text-button full" onClick={() => void signOut()}>{t("auth.signOut")}</button></div>;
  return <div className="setting-block account-block"><span>{t("auth.account")}</span><p className="privacy-note">{t("auth.signInHelp")}</p><Link className="secondary full button-link" href="/auth/login?next=/">{t("auth.signIn")}</Link></div>;
}
