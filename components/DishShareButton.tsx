"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useUiText } from "@/components/useUiText";

export function DishShareButton({ title }: { title: string }) {
  const t = useUiText();
  const [status, setStatus] = useState("");
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${title} on Trinque`, url });
      else { await navigator.clipboard.writeText(url); setStatus(t("dish.linkCopied")); window.setTimeout(() => setStatus(""), 1800); }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setStatus(t("dish.shareFailed")); }
  }
  return <><button className="secondary compact-action" type="button" onClick={() => void share()}><Icon name="share" size={16} />{t("dish.share")}</button>{status && <span className="sr-only" role="status">{status}</span>}</>;
}
