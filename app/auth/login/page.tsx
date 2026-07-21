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
  return <main className="login-page"><section className="login-story"><span className="kicker">Your table is waiting</span><h1>Good food finds good company.</h1><p>Save memorable dishes, follow people whose taste you trust, and make the next dinner plan together.</p><ul><li>A personal library of real finds</li><li>Community notes, not anonymous ratings</li><li>Group plans that respect everyone at the table</li></ul>{!open && <button className="primary" onClick={() => setOpen(true)}>Continue to sign in</button>}</section><AuthModal key={mode} open={open} initialMode={mode} onClose={() => setOpen(false)} /></main>;
}
