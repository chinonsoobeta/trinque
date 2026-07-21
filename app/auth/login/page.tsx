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
  const contextMessage = context === "save" ? "Save this dish to your Trinque collection." : context === "group" ? "Sign in to start or join a dining plan." : context === "publish" ? "Sign in to publish this reviewed dish to Trinque." : undefined;
  return <LoginShell mode={mode} contextMessage={contextMessage} />;
}

function LoginShell({ mode, contextMessage }: { mode: AuthMode; contextMessage?: string }) {
  return <main className="auth-page">
    <section className="auth-story"><span className="kicker">Good food finds good company.</span><h1>Your next favourite dish is worth remembering.</h1><p>Discover publicly, then sign in when you want to save dishes, publish what you ate, follow people, comment, or coordinate a group dinner.</p><div className="auth-story-note"><span aria-hidden="true">✦</span><p>Trinque keeps the food first: large photography, honest provenance, and social context without turning discovery into a dashboard.</p></div></section>
    <AuthModal key={mode} open initialMode={mode} embedded contextMessage={contextMessage} onClose={() => window.location.assign("/")} />
  </main>;
}
