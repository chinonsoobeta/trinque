import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, likes, profiles, publishedDishes, restaurants } from "@/db/schema";
import { AppAvatar, EmptyState, PageContainer } from "@/components/AppPrimitives";
import { CommentSection } from "@/components/CommentSection";
import { DishOwnerControls } from "@/components/DishOwnerControls";
import { DishShareButton } from "@/components/DishShareButton";
import { LikeButton } from "@/components/LikeButton";

export default async function DishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [dish] = await db.select({
    id: publishedDishes.id, ownerId: publishedDishes.ownerId, name: publishedDishes.name, cuisine: publishedDishes.cuisine, ingredients: publishedDishes.ingredients, dietary: publishedDishes.dietary, confidence: publishedDishes.confidence, description: publishedDishes.description, imageKey: publishedDishes.imageKey, provenance: publishedDishes.provenance, verificationStatus: publishedDishes.verificationStatus, availabilityKnowledge: publishedDishes.availabilityKnowledge, availabilityConfidence: publishedDishes.availabilityConfidence, lastConfirmedAt: publishedDishes.lastConfirmedAt, priceAmount: publishedDishes.priceAmount, currencyCode: publishedDishes.currencyCode, createdAt: publishedDishes.createdAt, restaurantName: restaurants.name, restaurantAddress: restaurants.address, restaurantLocality: restaurants.locality, contributorName: profiles.displayName, contributorHandle: profiles.handle, contributorAvatarUrl: profiles.avatarUrl,
  }).from(publishedDishes).leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId)).leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId)).where(eq(publishedDishes.id, id)).limit(1);
  if (!dish) return <PageContainer className="dish-detail-page"><EmptyState eyebrow="Dish" title="Dish not found" body="This dish may have been removed or is no longer available." action={<a className="secondary button-link" href="/explore">Explore dishes</a>} /></PageContainer>;
  const [[likeCount], [commentCount], related] = await Promise.all([
    db.select({ count: count() }).from(likes).where(eq(likes.dishId, id)),
    db.select({ count: count() }).from(comments).where(eq(comments.dishId, id)),
    db.select({ id: publishedDishes.id, name: publishedDishes.name, description: publishedDishes.description, imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.cuisine, dish.cuisine), ne(publishedDishes.id, id))).orderBy(desc(publishedDishes.createdAt)).limit(6),
  ]);
  const contributor = dish.contributorName ?? (dish.contributorHandle ? `@${dish.contributorHandle}` : "Trinque community");
  const price = dish.priceAmount != null && dish.currencyCode ? new Intl.NumberFormat("en-CA", { style: "currency", currency: dish.currencyCode }).format(dish.priceAmount) : null;
  return <PageContainer className="dish-detail-page">
    <article className="dish-detail-article">
      <div className={`dish-detail-image${dish.imageKey ? "" : " is-empty"}`}>{dish.imageKey ? <img src={`/api/media/${dish.imageKey}`} alt={dish.name} /> : <div><span aria-hidden="true">✦</span><p>The contributor chose not to retain this photo.</p></div>}</div>
      <div className="dish-detail-main">
        <span className="kicker">{dish.cuisine}</span><h1>{dish.name}</h1>
        <p className="dish-restaurant">{dish.restaurantName ?? "Restaurant not attached"}{dish.restaurantLocality ? <span> · {dish.restaurantLocality}</span> : null}</p>
        <p className="dish-description">{dish.description}</p>
        <div className="dish-contributor">{dish.contributorHandle ? <a href={`/profiles/${dish.contributorHandle}`}><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>Shared by</small><b>{contributor}</b><em>@{dish.contributorHandle}</em></span></a> : <div><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>Shared by</small><b>{contributor}</b></span></div>}</div>
        <div className="dish-detail-actions"><LikeButton dishId={id} initialCount={likeCount?.count ?? 0} /><a className="secondary compact-action button-link" href="#comments">◌ {commentCount?.count ?? 0} comments</a><DishShareButton title={dish.name} /></div>
        <section className="dish-facts"><div className="section-heading"><div><span className="kicker">What we know</span><h2>Dish details</h2></div></div><dl><dt>Ingredients</dt><dd>{dish.ingredients || "Not provided"}</dd><dt>Dietary notes</dt><dd>{dish.dietary || "Not provided"}</dd>{price && <><dt>Known price</dt><dd>{price}</dd></>}<dt>Availability</dt><dd>{dish.availabilityKnowledge.replaceAll("_", " ")}{dish.lastConfirmedAt ? ` · last confirmed ${new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(dish.lastConfirmedAt))}` : ""}</dd><dt>Verification</dt><dd>{dish.verificationStatus.replaceAll("_", " ")}</dd><dt>Provenance</dt><dd>{dish.provenance.replaceAll("_", " ")}</dd><dt>Identification confidence</dt><dd>{dish.confidence}%</dd>{dish.restaurantName && <><dt>Restaurant</dt><dd>{dish.restaurantName}{dish.restaurantAddress ? ` · ${dish.restaurantAddress}` : ""}</dd></>}</dl></section>
        <DishOwnerControls dishId={id} ownerId={dish.ownerId} />
      </div>
    </article>
    <section id="comments" className="dish-comments-block"><div className="section-heading"><div><span className="kicker">Around the table</span><h2>Comments</h2></div></div><CommentSection dishId={id} /></section>
    {related.length > 0 && <section className="related-dishes"><div className="section-heading"><div><span className="kicker">Keep exploring</span><h2>Related dishes</h2></div></div><div className="related-dish-grid">{related.map((item) => <a className="related-dish-card" href={`/dishes/${item.id}`} key={item.id}>{item.imageKey ? <img src={`/api/media/${item.imageKey}`} alt="" /> : <div className="related-placeholder" aria-hidden="true">✦</div>}<div><h3>{item.name}</h3><p>{item.description}</p></div></a>)}</div></section>}
  </PageContainer>;
}
