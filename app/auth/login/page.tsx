"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthModal, type AuthMode } from "@/components/AuthModal";
import { useUiText } from "@/components/useUiText";

export default function LoginPage() {
  return <Suspense fallback={<LoginShell mode="signin" />}><LoginContent /></Suspense>;
}

function LoginContent() {
  const t = useUiText();
  const searchParams = useSearchParams();
  const mode: AuthMode = searchParams.get("recovery") === "1" ? "recovery" : "signin";
  const context = searchParams.get("context");
  const contextMessage = context === "group" ? t("group.createBody") : context === "publish" ? t("analysis.reviewTitle") : context === "save" ? t("auth.signInBody") : undefined;
  return <LoginShell mode={mode} contextMessage={contextMessage} />;
}

function LoginShell({ mode, contextMessage }: { mode: AuthMode; contextMessage?: string }) {
  const t = useUiText();
  return <main className="auth-page">
    <section className="auth-story"><span className="kicker">{t("home.eyebrow")}</span><h1>{t("home.savedTitle")}</h1><p>{t("auth.signInHelp")}</p><div className="auth-story-note"><span aria-hidden="true">✦</span><p>{t("analysis.canonicalNotice")}</p></div></section>
    <AuthModal key={mode} open initialMode={mode} embedded contextMessage={contextMessage} onClose={() => window.location.assign("/")} />
  </main>;
}
