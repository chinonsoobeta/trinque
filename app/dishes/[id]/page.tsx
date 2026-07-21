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
    imageKey: publishedDishes.imageKey,
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
    db.select({ id: publishedDishes.id, name: publishedDishes.name, description: publishedDishes.description, imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.cuisine, dish.cuisine), ne(publishedDishes.id, id))).orderBy(desc(publishedDishes.createdAt)).limit(6),
  ]);
  return <main className="dish-detail-page"><article><div className="dish-detail-visual">{dish.imageKey ? <img src={`/api/media/${dish.imageKey}`} alt={dish.name} /> : <div className="dish-media-fallback"><span>{dish.cuisine}</span><b>{dish.name}</b></div>}</div><div className="dish-detail-copy"><header><p>{dish.cuisine}{dish.restaurantName ? ` · ${dish.restaurantName}` : ""}</p><h1>{dish.name}</h1>{dish.contributorHandle && <p>Shared by <a href={`/profiles/${dish.contributorHandle}`}>{dish.contributorName ?? `@${dish.contributorHandle}`}</a>{dish.restaurantAddress ? ` from ${dish.restaurantAddress}` : ""}</p>}</header><p>{dish.description}</p><div className="dish-actions"><LikeButton dishId={id} initialCount={likeCount?.count ?? 0} /><a href="#comments">{commentCount?.count ?? 0} comments</a></div><dl><dt>Ingredients</dt><dd>{dish.ingredients}</dd><dt>Dietary notes</dt><dd>{dish.dietary}</dd><dt>Identification</dt><dd>{dish.confidence}% confidence</dd><dt>Source</dt><dd>{dish.provenance} · {dish.verificationStatus}</dd><dt>Availability</dt><dd>{dish.availabilityKnowledge}{dish.lastConfirmedAt ? ` · confirmed ${new Date(dish.lastConfirmedAt).toLocaleDateString()}` : ""}</dd></dl><DishOwnerControls dishId={id} ownerId={dish.ownerId} /></div></article><div id="comments"><CommentSection dishId={id} /></div>{related.length > 0 && <section><span className="kicker">Keep exploring</span><h2>More {dish.cuisine} finds</h2><div className="dish-grid">{related.map((item) => <a className="dish-card" href={`/dishes/${item.id}`} key={item.id}>{item.imageKey && <div className="dish-image" style={{ backgroundImage: `url(/api/media/${item.imageKey})` }} />}<div className="dish-body"><h3>{item.name}</h3><p>{item.description}</p></div></a>)}</div></section>}</main>;
}
