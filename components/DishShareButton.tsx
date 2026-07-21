"use client";

import { useState } from "react";

export function DishShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState("");
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${title} on Trinque`, url });
      else { await navigator.clipboard.writeText(url); setStatus("Link copied"); window.setTimeout(() => setStatus(""), 1800); }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setStatus("Unable to share"); }
  }
  return <><button className="secondary compact-action" type="button" onClick={() => void share()}>↗ Share</button>{status && <span className="sr-only" role="status">{status}</span>}</>;
}
