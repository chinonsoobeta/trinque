import Image from "next/image";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, likes, profiles, publishedDishes, restaurants } from "@/db/schema";
import { AppAvatar, EmptyState, PageContainer } from "@/components/AppPrimitives";
import { CommentSection } from "@/components/CommentSection";
import { DishOwnerControls } from "@/components/DishOwnerControls";
import { DishShareButton } from "@/components/DishShareButton";
import { LikeButton } from "@/components/LikeButton";
import { SafetyActions } from "@/components/SafetyActions";

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
      <div className={`dish-detail-image${dish.imageKey ? "" : " is-empty"}`}>{dish.imageKey ? <Image src={`/api/media/${dish.imageKey}`} alt={dish.name} width={1200} height={900} sizes="(max-width: 768px) 100vw, 50vw" /> : <div><span aria-hidden="true">✦</span><p>The person who posted this did not keep the photo.</p></div>}</div>
      <div className="dish-detail-main">
        <span className="kicker">{dish.cuisine}</span><h1>{dish.name}</h1>
        <p className="dish-restaurant">{dish.restaurantName ?? "No restaurant added"}{dish.restaurantLocality ? <span> · {dish.restaurantLocality}</span> : null}</p>
        <p className="dish-description">{dish.description}</p>
        <div className="dish-contributor">{dish.contributorHandle ? <a href={`/profiles/${dish.contributorHandle}`}><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>Shared by</small><b>{contributor}</b><em>@{dish.contributorHandle}</em></span></a> : <div><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>Shared by</small><b>{contributor}</b></span></div>}</div>
        <div className="dish-detail-actions"><LikeButton dishId={id} initialCount={likeCount?.count ?? 0} /><a className="secondary compact-action button-link" href="#comments">◌ {commentCount?.count ?? 0} comments</a><DishShareButton title={dish.name} /></div>
        <section className="dish-facts"><div className="section-heading"><div><span className="kicker">Dish facts</span><h2>About this dish</h2></div></div><dl><dt>Ingredients</dt><dd>{dish.ingredients || "Not listed"}</dd><dt>Food notes</dt><dd>{dish.dietary || "Not listed"}</dd>{price && <><dt>Price seen</dt><dd>{price}</dd></>}<dt>Menu status</dt><dd>{dish.availabilityKnowledge.replaceAll("_", " ")}{dish.lastConfirmedAt ? ` · checked ${new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(dish.lastConfirmedAt))}` : ""}</dd><dt>Checked by</dt><dd>{dish.verificationStatus.replaceAll("_", " ")}</dd><dt>Source</dt><dd>{dish.provenance.replaceAll("_", " ")}</dd><dt>Photo check</dt><dd>{dish.confidence}%</dd>{dish.restaurantName && <><dt>Restaurant</dt><dd>{dish.restaurantName}{dish.restaurantAddress ? ` · ${dish.restaurantAddress}` : ""}</dd></>}</dl></section>
        <DishOwnerControls dishId={id} ownerId={dish.ownerId} />
        <SafetyActions targetType="dish" targetId={id} userId={dish.ownerId} allowHide />
      </div>
    </article>
    <section id="comments" className="dish-comments-block"><div className="section-heading"><div><span className="kicker">Around the table</span><h2>Comments</h2></div></div><CommentSection dishId={id} dishOwnerId={dish.ownerId} /></section>
    {related.length > 0 && <section className="related-dishes"><div className="section-heading"><div><span className="kicker">Keep exploring</span><h2>Related dishes</h2></div></div><div className="related-dish-grid">{related.map((item) => <a className="related-dish-card" href={`/dishes/${item.id}`} key={item.id}>{item.imageKey ? <Image src={`/api/media/${item.imageKey}`} alt="" width={480} height={360} sizes="(max-width: 768px) 100vw, 33vw" /> : <div className="related-placeholder" aria-hidden="true">✦</div>}<div><h3>{item.name}</h3><p>{item.description}</p></div></a>)}</div></section>}
  </PageContainer>;
}
