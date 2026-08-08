"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DishEditDialog } from "@/components/DishEditDialog";
import { useUiText } from "@/components/useUiText";

/**
 * Edit and delete for the person who published the dish. Editing used to be
 * reachable only from a feed card on the home screen, which meant it vanished
 * as soon as the dish fell out of that feed.
 */
export function DishOwnerControls({ dishId, ownerId }: { dishId: string; ownerId: string }) {
  const { identity, sessionToken } = useAuth();
  const t = useUiText();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!identity || identity.id !== ownerId || !sessionToken) return null;

  async function remove() {
    if (!window.confirm(t("owner.deleteDishConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}`, { method: "DELETE", headers: { Authorization: `Guest ${sessionToken}` } });
      if (response.ok) window.location.assign("/explore");
    } finally { setBusy(false); }
  }

  return <div className="modal-actions">
    <button className="secondary" onClick={() => setEditing(true)}>{t("owner.editTitle")}</button>
    <button className="text-button" disabled={busy} onClick={() => void remove()}>{t("privacy.deleteDish")}</button>
    {editing && <DishEditDialog dish={{ id: dishId }} t={t} guestToken={sessionToken} onClose={() => setEditing(false)} onUpdated={() => window.location.reload()} />}
  </div>;
}
