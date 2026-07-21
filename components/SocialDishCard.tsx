import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { LikeButton } from "@/components/LikeButton";

export type SocialDish = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  confidence: number;
  createdAt: string;
  imageUrl?: string | null;
  restaurantName?: string | null;
  restaurantLocality?: string | null;
  contributorName?: string | null;
  contributorHandle?: string | null;
  contributorAvatarUrl?: string | null;
  likes24h?: number;
  comments24h?: number;
};

export function SocialDishCard({ dish, trending = false }: { dish: SocialDish; trending?: boolean }) {
  const initials = (dish.contributorName ?? dish.contributorHandle ?? "T").slice(0, 2).toUpperCase();
  return <article className="social-dish-card">
    <Link className="social-dish-media" href={`/dishes/${dish.id}`} aria-label={`View ${dish.name}`}>
      {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} /> : <div className="dish-media-fallback"><span>{dish.cuisine}</span><b>{dish.name}</b></div>}
      {dish.restaurantName && <span className="restaurant-pill"><MapPin aria-hidden="true" />{dish.restaurantName}</span>}
    </Link>
    <div className="social-dish-content">
      <div className="contributor-row">
        {dish.contributorHandle ? <Link href={`/profiles/${dish.contributorHandle}`} className="contributor-avatar">{dish.contributorAvatarUrl ? <img src={dish.contributorAvatarUrl} alt="" /> : initials}</Link> : <span className="contributor-avatar">{initials}</span>}
        <div><b>{dish.contributorName ?? "Trinque community"}</b><small>{dish.restaurantLocality ?? new Date(dish.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div>
      </div>
      <Link className="dish-card-copy" href={`/dishes/${dish.id}`}><span>{dish.cuisine}</span><h3>{dish.name}</h3><p>{dish.description}</p></Link>
      <div className="social-dish-actions"><LikeButton dishId={dish.id} /><Link href={`/dishes/${dish.id}#comments`}><MessageCircle aria-hidden="true" />{trending ? dish.comments24h ?? 0 : "Discuss"}</Link>{trending && <small>{dish.likes24h ?? 0} likes today</small>}</div>
    </div>
  </article>;
}
