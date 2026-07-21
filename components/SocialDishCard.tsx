import Image from "next/image";
import Link from "next/link";
import { AppAvatar } from "@/components/AppPrimitives";
import { LikeButton } from "@/components/LikeButton";

export type SocialDish = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  imageUrl?: string | null;
  restaurantName?: string | null;
  locality?: string | null;
  contributorName?: string | null;
  contributorHandle?: string | null;
  contributorAvatarUrl?: string | null;
  provenance?: string | null;
  verificationStatus?: string | null;
  likesCount?: number;
  commentsCount?: number;
};

export function SocialDishCard({ dish, engagementLabel }: { dish: SocialDish; engagementLabel?: string }) {
  const contributor = dish.contributorName ?? (dish.contributorHandle ? `@${dish.contributorHandle}` : "Trinque community");
  return <article className="social-dish-card">
    <Link className={`social-dish-media${dish.imageUrl ? "" : " is-empty"}`} href={`/dishes/${dish.id}`} aria-label={`Open ${dish.name}`}>
      {dish.imageUrl ? <Image src={dish.imageUrl} alt={dish.name} width={960} height={720} sizes="(max-width: 768px) 100vw, 50vw" unoptimized /> : <span aria-hidden="true">Dish photo not retained</span>}
      <div className="social-dish-overlay"><span>{dish.restaurantName ?? "Community dish"}</span>{dish.locality && <small>{dish.locality}</small>}</div>
    </Link>
    <div className="social-dish-content">
      <div className="social-contributor-row">
        {dish.contributorHandle ? <Link className="social-contributor" href={`/profiles/${dish.contributorHandle}`}><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="small" /><span><b>{contributor}</b><small>@{dish.contributorHandle}</small></span></Link> : <div className="social-contributor"><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="small" /><span><b>{contributor}</b><small>Community contribution</small></span></div>}
        <span className="dish-cuisine-chip">{dish.cuisine}</span>
      </div>
      <Link className="social-dish-copy" href={`/dishes/${dish.id}`}><h2>{dish.name}</h2><p>{dish.description}</p></Link>
      {(dish.provenance || dish.verificationStatus) && <p className="record-honesty">{dish.provenance?.replaceAll("_", " ")}{dish.provenance && dish.verificationStatus ? " · " : ""}{dish.verificationStatus?.replaceAll("_", " ")}</p>}
      <div className="social-dish-actions"><LikeButton dishId={dish.id} initialCount={dish.likesCount ?? 0} /><Link className="comment-link" href={`/dishes/${dish.id}#comments`} aria-label={`View comments on ${dish.name}`}>◌ {dish.commentsCount != null ? `${dish.commentsCount} ` : ""}<span>Comments</span></Link><Link className="details-link" href={`/dishes/${dish.id}`}>View dish →</Link></div>
      {engagementLabel && <small className="engagement-note">{engagementLabel}</small>}
    </div>
  </article>;
}
