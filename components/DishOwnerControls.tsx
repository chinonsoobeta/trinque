"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useUiText } from "@/components/useUiText";

export function DishOwnerControls({ dishId, ownerId }: { dishId: string; ownerId: string }) {
  const { identity, sessionToken } = useAuth();
  const t = useUiText();
  const [busy, setBusy] = useState(false);
  if (!identity || identity.id !== ownerId || !sessionToken) return null;
  async function remove() {
    if (!window.confirm(t("owner.deleteDishConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}`, { method: "DELETE", headers: { Authorization: `Guest ${sessionToken}` } });
      if (response.ok) window.location.assign("/explore");
    } finally { setBusy(false); }
  }
  return <div className="modal-actions"><button className="text-button" disabled={busy} onClick={() => void remove()}>{t("privacy.deleteDish")}</button></div>;
}
