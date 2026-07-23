"use client";

import { useState } from "react";
import type { MessageKey } from "@/ios/i18n";
import { SafetyActions } from "@/components/SafetyActions";

export type FeedDish = {
  id: string;
  name: string;
  description?: string;
  caption?: string;
  cuisine?: string;
  confidence?: number;
  imageUrl?: string | null;
  localPreview?: string;
  provenance?: string;
  verificationStatus?: string;
  availabilityKnowledge?: string;
  contributorLabel?: string;
  authorLabel?: string;
  authorInitials?: string;
  createdAt?: string;
  likes?: number;
  commentCount?: number;
  isSaved?: boolean;
  isOwner?: boolean;
  contributorId?: string;
  sourceMode?: "live" | "demo";
  restaurant?: { name: string } | null;
  locationTag?: string;
  price?: string;
  tasteNotes?: string;
  dietaryNotes?: string;
  personalComments?: string;
  moderationStatus?: string;
};

type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

function timeAgo(dateString: string, t: Translator, language?: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.now");
  if (mins < 60) return t("time.minutes", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.days", { count: days });
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(dateString));
}

export function FeedCard({ dish, t, language, onSave, onDelete, onLike, onEdit }: {
  dish: FeedDish;
  t: Translator;
  language?: string;
  onSave?: (id: string) => void;
  onDelete?: (id: string, imageOnly?: boolean) => void;
  onLike?: (id: string) => void;
  onEdit?: (dish: FeedDish) => void;
}) {
  const [safetyOpen, setSafetyOpen] = useState(false);
  const initials = dish.authorInitials ?? dish.contributorLabel?.slice(0, 2).toUpperCase() ?? "?";
  const authorName = dish.authorLabel ?? dish.contributorLabel ?? t("auth.guest");
  const timeLabel = dish.createdAt ? timeAgo(dish.createdAt, t, language) : "";
  const provenance = dish.provenance && t(`provenance.${dish.provenance}` as MessageKey);
  const verification = dish.verificationStatus && t(`verification.${dish.verificationStatus}` as MessageKey);
  const availability = dish.availabilityKnowledge === "recently_confirmed" ? t("availability.confirmed") : dish.availabilityKnowledge ? t("availability.unknown") : "";

  return (
    <article className="feed-card">
      <div className="feed-card-header">
        <div className="feed-card-author">
          <span className="feed-card-avatar">{initials}</span>
          <div>
            <strong>{authorName}</strong>
            <small>{timeLabel}{dish.locationTag ? ` · ${dish.locationTag}` : ""}</small>
          </div>
        </div>
        <div className="feed-card-actions-top">
          <button className="feed-card-safety" onClick={() => setSafetyOpen((v) => !v)} aria-label={t("safety.title")}>•••</button>
        </div>
      </div>

      {safetyOpen ? <SafetyActions targetType="dish" targetId={dish.id} userId={dish.contributorId} allowHide /> : null}

      {dish.imageUrl || dish.localPreview ? (
        <div className="feed-card-image" style={{ backgroundImage: `url(${dish.localPreview ?? dish.imageUrl})` }} />
      ) : null}

      <div className="feed-card-body">
        <div className="feed-card-title-row">
          <h3 className="feed-card-dish-name">{dish.name}</h3>
          {dish.price ? <span className="feed-card-price">{dish.price}</span> : null}
        </div>

        {dish.description ? <p className="feed-card-caption">{dish.caption ?? dish.description}</p> : null}

        {dish.tasteNotes && dish.tasteNotes !== dish.description ? <p className="feed-card-taste-notes">{dish.tasteNotes}</p> : null}

        {dish.restaurant?.name ? (
          <div className="feed-card-restaurant">
            <span>{dish.restaurant.name}</span>
          </div>
        ) : null}

        {provenance || verification || availability ? (
          <p className="feed-card-labels">
            {provenance ? <span>{provenance}</span> : null}
            {verification ? <span>{verification}</span> : null}
            {availability ? <span>{availability}</span> : null}
          </p>
        ) : null}

        {dish.sourceMode ? (
          <p className="feed-card-source">
            {dish.sourceMode === "live" ? t("analysis.live") : t("analysis.demo")} · {dish.confidence ?? "—"}% {t("analysis.confident", { confidence: 0 }).split("{")[0].trim()}
          </p>
        ) : null}

        {dish.moderationStatus && dish.moderationStatus !== "active" && dish.isOwner ? <div className="moderation-banner">{dish.moderationStatus === "hidden" ? t("safety.moderationHidden") : t("safety.moderationRemoved")}</div> : null}
      </div>

      <div className="feed-card-actions">
        <button className="feed-card-action" onClick={() => onLike?.(dish.id)} aria-label={t("dish.like")}>
          ♡ {(dish.likes ?? 0) > 0 ? t("dish.likeCount", { count: dish.likes }) : ""}
        </button>
        <button className="feed-card-action" onClick={() => window.location.assign(`/dishes/${dish.id}`)} aria-label={t("comments.add")}>
          ◷ {(dish.commentCount ?? 0) > 0 ? t("dish.commentCount", { count: dish.commentCount }) : ""}
        </button>
        <button className="feed-card-action" onClick={() => onSave?.(dish.id)} aria-label={dish.isSaved ? t("save.removed") : t("save.added")}>
          {dish.isSaved ? "♥" : "♡"}
        </button>
        <button className="feed-card-action" onClick={() => { const url = `${window.location.origin}/dishes/${dish.id}`; if (navigator.share) navigator.share({ title: dish.name, url }).catch(() => undefined); else navigator.clipboard?.writeText(url).catch(() => undefined); }} aria-label={t("dish.share")}>↗</button>
      </div>

      {onDelete || onEdit ? (
        <div className="feed-card-owner-actions">
          {onEdit ? <button className="text-button" onClick={() => onEdit(dish)}>{t("owner.edit")}</button> : null}
          {dish.imageUrl && onDelete ? <button className="text-button" onClick={() => onDelete(dish.id, true)}>{t("privacy.deleteImage")}</button> : null}
          {onDelete ? <button className="text-button" onClick={() => onDelete(dish.id)}>{t("privacy.deleteDish")}</button> : null}
        </div>
      ) : null}
    </article>
  );
}
