import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, likes, profiles, publishedDishes, restaurants } from "@/db/schema";
import { DishDetailView, DishNotFound } from "@/components/DishDetailView";

export default async function DishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const db = await getDb();
  const [dish] = await db.select({
    id: publishedDishes.id, ownerId: publishedDishes.ownerId, name: publishedDishes.name, cuisine: publishedDishes.cuisine, ingredients: publishedDishes.ingredients, dietary: publishedDishes.dietary, confidence: publishedDishes.confidence, description: publishedDishes.description, imageKey: publishedDishes.imageKey, provenance: publishedDishes.provenance, verificationStatus: publishedDishes.verificationStatus, availabilityKnowledge: publishedDishes.availabilityKnowledge, lastConfirmedAt: publishedDishes.lastConfirmedAt, priceAmount: publishedDishes.priceAmount, currencyCode: publishedDishes.currencyCode, restaurantName: restaurants.name, restaurantAddress: restaurants.address, restaurantLocality: restaurants.locality, contributorName: profiles.displayName, contributorHandle: profiles.handle, contributorAvatarUrl: profiles.avatarUrl,
  }).from(publishedDishes).leftJoin(restaurants, eq(restaurants.id, publishedDishes.restaurantId)).leftJoin(profiles, eq(profiles.userId, publishedDishes.ownerId)).where(eq(publishedDishes.id, id)).limit(1);
  if (!dish) return <DishNotFound />;
  const [[likeCount], [commentCount], related] = await Promise.all([
    db.select({ count: count() }).from(likes).where(eq(likes.dishId, id)),
    db.select({ count: count() }).from(comments).where(eq(comments.dishId, id)),
    db.select({ id: publishedDishes.id, name: publishedDishes.name, description: publishedDishes.description, imageKey: publishedDishes.imageKey }).from(publishedDishes).where(and(eq(publishedDishes.cuisine, dish.cuisine), ne(publishedDishes.id, id))).orderBy(desc(publishedDishes.createdAt)).limit(6),
  ]);
  return <DishDetailView dish={dish} related={related} likeCount={likeCount?.count ?? 0} commentCount={commentCount?.count ?? 0} />;
}
