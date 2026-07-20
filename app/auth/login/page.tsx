"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthModal, type AuthMode } from "@/components/AuthModal";

export default function LoginPage() {
  return <Suspense fallback={<LoginShell mode="signin" />}><LoginContent /></Suspense>;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const mode: AuthMode = searchParams.get("recovery") === "1" ? "recovery" : "signin";
  return <LoginShell mode={mode} />;
}

function LoginShell({ mode }: { mode: AuthMode }) {
  const [open, setOpen] = useState(true);
  return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" }}>
    <div><h1>Sign in to Trinque</h1><p>Browsing stays public. An account is required for saves, publishing, groups, and social actions.</p>{!open && <button className="primary" onClick={() => setOpen(true)}>Open sign in</button>}</div>
    <AuthModal key={mode} open={open} initialMode={mode} onClose={() => setOpen(false)} />
  </main>;
}
