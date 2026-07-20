import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, likes, profiles, publishedDishes, restaurants } from "@/db/schema";
import { CommentSection } from "@/components/CommentSection";
import { DishOwnerControls } from "@/components/DishOwnerControls";
import { LikeButton } from "@/components/LikeButton";

export default async function DishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [dish] = await db.select({
    id: publishedDishes.id,
    ownerId: publishedDishes.ownerId,
    name: publishedDishes.name,
    cuisine: publishedDishes.cuisine,
    ingredients: publishedDishes.ingredients,
    dietary: publishedDishes.dietary,
    confidence: publishedDishes.confidence,
    description: publishedDishes.description,
    provenance: publishedDishes.provenance,
    verificationStatus: publishedDishes.verificationStatus,
    availabilityKnowledge: publishedDishes.availabilityKnowledge,
    availabilityConfidence: publishedDishes.availabilityConfidence,
    lastConfirmedAt: publishedDishes.lastConfirmedAt,
    priceAmount: publishedDishes.priceAmount,
    currencyCode: publishedDishes.currencyCode,
    createdAt: publishedDishes.createdAt,
    restaurantName: restaurants.name,
    restaurantAddress: restaurants.address,
    contributorName: profiles.displayName,
    contributorHandle: profiles.handle,
  }).from(publishedDishes).leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId)).leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId)).where(eq(publishedDishes.id, id)).limit(1);
  if (!dish) return <main><h1>Dish not found</h1></main>;
  const [[likeCount], [commentCount], related] = await Promise.all([
    db.select({ count: count() }).from(likes).where(eq(likes.dishId, id)),
    db.select({ count: count() }).from(comments).where(eq(comments.dishId, id)),
    db.select({ id: publishedDishes.id, name: publishedDishes.name, description: publishedDishes.description }).from(publishedDishes).where(and(eq(publishedDishes.cuisine, dish.cuisine), ne(publishedDishes.id, id))).orderBy(desc(publishedDishes.createdAt)).limit(6),
  ]);
  return <main className="dish-detail-page"><article><header><p>{dish.cuisine}</p><h1>{dish.name}</h1>{dish.contributorHandle && <p>Contributed by <a href={`/profiles/${dish.contributorHandle}`}>{dish.contributorName ?? `@${dish.contributorHandle}`}</a></p>}</header><p>{dish.description}</p><dl><dt>Ingredients</dt><dd>{dish.ingredients}</dd><dt>Dietary</dt><dd>{dish.dietary}</dd><dt>Confidence</dt><dd>{dish.confidence}%</dd><dt>Provenance</dt><dd>{dish.provenance}</dd><dt>Verification</dt><dd>{dish.verificationStatus}</dd><dt>Availability</dt><dd>{dish.availabilityKnowledge}{dish.lastConfirmedAt ? ` · last confirmed ${dish.lastConfirmedAt}` : ""}</dd>{dish.restaurantName && <><dt>Restaurant</dt><dd>{dish.restaurantName}{dish.restaurantAddress ? ` · ${dish.restaurantAddress}` : ""}</dd></>}</dl><div className="dish-actions"><LikeButton dishId={id} initialCount={likeCount?.count ?? 0} /><span>{commentCount?.count ?? 0} comments</span></div><DishOwnerControls dishId={id} ownerId={dish.ownerId} /></article><CommentSection dishId={id} />{related.length > 0 && <section><h2>Related dishes</h2><div className="dish-grid">{related.map((item) => <a className="dish-card" href={`/dishes/${item.id}`} key={item.id}><div className="dish-body"><h3>{item.name}</h3><p>{item.description}</p></div></a>)}</div></section>}</main>;
}
