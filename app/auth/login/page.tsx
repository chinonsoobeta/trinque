"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthModal, type AuthMode } from "@/components/AuthModal";

export default function LoginPage() {
  return <Suspense fallback={<LoginShell mode="signin" />}><LoginContent /></Suspense>;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const mode: AuthMode = searchParams.get("recovery") === "1" ? "recovery" : "signin";
  const context = searchParams.get("context");
  const contextMessage = context === "save" ? "Sign in to save this dish." : context === "group" ? "Sign in to start or join a meal plan." : context === "publish" ? "Sign in to post this checked dish." : undefined;
  return <LoginShell mode={mode} contextMessage={contextMessage} />;
}

function LoginShell({ mode, contextMessage }: { mode: AuthMode; contextMessage?: string }) {
  return <main className="auth-page">
    <section className="auth-story"><span className="kicker">Find dishes</span><h1>Keep track of dishes you like.</h1><p>Anyone can browse. Sign in to save dishes, post what you ate, follow people, comment, or plan a group meal.</p><div className="auth-story-note"><span aria-hidden="true">✦</span><p>Trinque puts food first. We show dish photos and clear facts about where the details came from.</p></div></section>
    <AuthModal key={mode} open initialMode={mode} embedded contextMessage={contextMessage} onClose={() => window.location.assign("/")} />
  </main>;
}
