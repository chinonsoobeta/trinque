import type { MessageKey } from "@/ios/i18n";

export type FeedDish = {
  id: string;
  name: string;
  description?: string;
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
  sourceMode?: "live" | "demo";
  restaurant?: { name: string } | null;
  locationTag?: string;
  price?: string;
};

type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString();
}

export function FeedCard({ dish, t, onSave, onDelete, onLike }: {
  dish: FeedDish;
  t: Translator;
  onSave?: (id: string) => void;
  onDelete?: (id: string, imageOnly?: boolean) => void;
  onLike?: (id: string) => void;
}) {
  const initials = dish.authorInitials ?? dish.contributorLabel?.slice(0, 2).toUpperCase() ?? "?";
  const authorName = dish.authorLabel ?? dish.contributorLabel ?? t("auth.guest");
  const timeLabel = dish.createdAt ? timeAgo(dish.createdAt) : "";
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
          <button className="feed-card-safety" aria-label={t("safety.title")}>•••</button>
        </div>
      </div>

      {dish.imageUrl || dish.localPreview ? (
        <div className="feed-card-image" style={{ backgroundImage: `url(${dish.localPreview ?? dish.imageUrl})` }} />
      ) : null}

      <div className="feed-card-body">
        <div className="feed-card-title-row">
          <h3 className="feed-card-dish-name">{dish.name}</h3>
          {dish.price ? <span className="feed-card-price">{dish.price}</span> : null}
        </div>

        {dish.description ? <p className="feed-card-caption">{dish.description}</p> : null}

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
      </div>

      <div className="feed-card-actions">
        <button className="feed-card-action" onClick={() => onLike?.(dish.id)} aria-label={t("dish.like")}>
          ♡ {(dish.likes ?? 0) > 0 ? dish.likes : ""}
        </button>
        <button className="feed-card-action" aria-label={t("comments.add")}>
          ◷ {(dish.commentCount ?? 0) > 0 ? dish.commentCount : ""}
        </button>
        <button className="feed-card-action" onClick={() => onSave?.(dish.id)} aria-label={dish.isSaved ? t("save.removed") : t("save.added")}>
          {dish.isSaved ? "♥" : "♡"}
        </button>
        <button className="feed-card-action" aria-label={t("dish.share")}>↗</button>
      </div>

      {onDelete ? (
        <div className="feed-card-owner-actions">
          {dish.imageUrl ? <button className="text-button" onClick={() => onDelete(dish.id, true)}>{t("privacy.deleteImage")}</button> : null}
          <button className="text-button" onClick={() => onDelete(dish.id)}>{t("privacy.deleteDish")}</button>
        </div>
      ) : null}
    </article>
  );
}
