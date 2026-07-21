"use client";

import Image from "next/image";
import Link from "next/link";
import { AppAvatar } from "@/components/AppPrimitives";
import { LikeButton } from "@/components/LikeButton";
import { useUiText } from "@/components/useUiText";
import type { MessageKey } from "@/ios/i18n";

export type SocialDish = {
  id: string; name: string; cuisine: string; description: string; imageUrl?: string | null;
  restaurantName?: string | null; locality?: string | null; contributorName?: string | null;
  contributorHandle?: string | null; contributorAvatarUrl?: string | null; provenance?: string | null;
  verificationStatus?: string | null; likesCount?: number; commentsCount?: number;
};

export function SocialDishCard({ dish, engagementLabel }: { dish: SocialDish; engagementLabel?: string }) {
  const t = useUiText();
  const contributor = dish.contributorName ?? (dish.contributorHandle ? `@${dish.contributorHandle}` : t("comments.member"));
  const provenance = dish.provenance ? t(`provenance.${dish.provenance}` as MessageKey) : "";
  const verification = dish.verificationStatus ? t(`verification.${dish.verificationStatus}` as MessageKey) : "";
  return <article className="social-dish-card">
    <Link className={`social-dish-media${dish.imageUrl ? "" : " is-empty"}`} href={`/dishes/${dish.id}`} aria-label={t("dish.open", { dish: dish.name })}>
      {dish.imageUrl ? <Image src={dish.imageUrl} alt={dish.name} width={960} height={720} sizes="(max-width: 768px) 100vw, 50vw" unoptimized /> : <span aria-hidden="true">{t("dish.noPhoto")}</span>}
      <div className="social-dish-overlay"><span>{dish.restaurantName ?? t("dish.userDish")}</span>{dish.locality && <small>{dish.locality}</small>}</div>
    </Link>
    <div className="social-dish-content">
      <div className="social-contributor-row">
        {dish.contributorHandle ? <Link className="social-contributor" href={`/profiles/${dish.contributorHandle}`}><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="small" /><span><b>{contributor}</b><small>@{dish.contributorHandle}</small></span></Link> : <div className="social-contributor"><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="small" /><span><b>{contributor}</b><small>{t("provenance.community_submitted")}</small></span></div>}
        <span className="dish-cuisine-chip">{dish.cuisine}</span>
      </div>
      <Link className="social-dish-copy" href={`/dishes/${dish.id}`}><h2>{dish.name}</h2><p>{dish.description}</p></Link>
      {(provenance || verification) && <p className="record-honesty">{provenance}{provenance && verification ? " · " : ""}{verification}</p>}
      <div className="social-dish-actions"><LikeButton dishId={dish.id} initialCount={dish.likesCount ?? 0} /><Link className="comment-link" href={`/dishes/${dish.id}#comments`} aria-label={t("comments.title")}>◌ {dish.commentsCount != null ? `${dish.commentsCount} ` : ""}<span>{t("comments.title")}</span></Link><Link className="details-link" href={`/dishes/${dish.id}`}>{t("dish.view")} →</Link></div>
      {engagementLabel && <small className="engagement-note">{engagementLabel}</small>}
    </div>
  </article>;
}
