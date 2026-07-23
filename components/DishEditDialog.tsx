import { useState } from "react";
import type { MessageKey } from "@/ios/i18n";

type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

const MAX_LENGTH = 1000;

export function DishEditDialog({ dish, t, guestToken, onClose, onUpdated }: {
  dish: { id: string; caption?: string; tasteNotes?: string; dietaryNotes?: string; personalComments?: string; locationTag?: string; imageRetained?: boolean; imageUrl?: string | null };
  t: Translator;
  guestToken: string | null;
  onClose: () => void;
  onUpdated: (fields: Record<string, string>) => void;
}) {
  const [caption, setCaption] = useState(dish.caption ?? "");
  const [tasteNotes, setTasteNotes] = useState(dish.tasteNotes ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(dish.dietaryNotes ?? "");
  const [personalComments, setPersonalComments] = useState(dish.personalComments ?? "");
  const [locationTag, setLocationTag] = useState(dish.locationTag ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!guestToken) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/dishes/${dish.id}`, {
        method: "PATCH",
        headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim(), tasteNotes: tasteNotes.trim(), dietaryNotes: dietaryNotes.trim(), personalComments: personalComments.trim(), locationTag: locationTag.trim() }),
      });
      if (!response.ok) { setError(t("error.generic")); return; }
      onUpdated({ caption: caption.trim(), tasteNotes: tasteNotes.trim(), dietaryNotes: dietaryNotes.trim(), personalComments: personalComments.trim(), locationTag: locationTag.trim() });
      onClose();
    } catch { setError(t("error.generic")); } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className="analyzer dish-edit-dialog">
        <button className="modal-close" onClick={onClose} aria-label={t("settings.close")}>×</button>
        <h2 id="edit-title">{t("owner.editTitle")}</h2>
        <div className="edit-field"><label>{t("analysis.field.description")}</label><textarea className="edit-input" value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_LENGTH))} rows={2} /></div>
        <div className="edit-field"><label>{t("dish.facts")}</label><input className="edit-input" value={locationTag} onChange={(e) => setLocationTag(e.target.value.slice(0, MAX_LENGTH))} placeholder={t("dish.noRestaurant")} /></div>
        <div className="edit-field"><label>{t("dish.about")}</label><textarea className="edit-input" value={tasteNotes} onChange={(e) => setTasteNotes(e.target.value.slice(0, MAX_LENGTH))} rows={2} /></div>
        <div className="edit-field"><label>{t("analysis.field.dietary")}</label><textarea className="edit-input" value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value.slice(0, MAX_LENGTH))} rows={2} /></div>
        <div className="edit-field"><label>{t("comments.add")}</label><textarea className="edit-input" value={personalComments} onChange={(e) => setPersonalComments(e.target.value.slice(0, MAX_LENGTH))} rows={2} /></div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="modal-actions">
          <button className="text-button" onClick={onClose}>{t("safety.cancel")}</button>
          <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? t("onboarding.saving") : t("analysis.publish")}</button>
        </div>
      </div>
    </div>
  );
}
