"use client";

import Image from "next/image";
import { AppAvatar, EmptyState, PageContainer } from "@/components/AppPrimitives";
import { CommentSection } from "@/components/CommentSection";
import { DishOwnerControls } from "@/components/DishOwnerControls";
import { DishShareButton } from "@/components/DishShareButton";
import { LikeButton } from "@/components/LikeButton";
import { SafetyActions } from "@/components/SafetyActions";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import type { MessageKey } from "@/ios/i18n";

export type DishDetail = { id: string; ownerId: string; name: string; cuisine: string; ingredients: string; dietary: string; confidence: number; description: string; imageKey: string | null; provenance: string; verificationStatus: string; availabilityKnowledge: string; lastConfirmedAt: string | null; priceAmount: number | null; currencyCode: string | null; restaurantName: string | null; restaurantAddress: string | null; restaurantLocality: string | null; contributorName: string | null; contributorHandle: string | null; contributorAvatarUrl: string | null };
export type RelatedDish = { id: string; name: string; description: string; imageKey: string | null };

export function DishNotFound() { const t = useUiText(); return <PageContainer className="dish-detail-page"><EmptyState eyebrow={t("analysis.field.name")} title={t("dish.notFound")} body={t("dish.removed")} action={<a className="secondary button-link" href="/explore">{t("home.explore")}</a>} /></PageContainer>; }

export function DishDetailView({ dish, related, likeCount, commentCount }: { dish: DishDetail; related: RelatedDish[]; likeCount: number; commentCount: number }) {
  const t = useUiText(); const language = useUiLanguage();
  const contributor = dish.contributorName ?? (dish.contributorHandle ? `@${dish.contributorHandle}` : t("comments.member"));
  const price = dish.priceAmount != null && dish.currencyCode ? new Intl.NumberFormat(language, { style: "currency", currency: dish.currencyCode }).format(dish.priceAmount) : null;
  const availabilityKey = dish.availabilityKnowledge === "recently_confirmed" ? "availability.confirmed" : "availability.unknown";
  return <PageContainer className="dish-detail-page"><article className="dish-detail-article">
    <div className={`dish-detail-image${dish.imageKey ? "" : " is-empty"}`}>{dish.imageKey ? <Image src={`/api/media/${dish.imageKey}`} alt={dish.name} width={1200} height={900} sizes="(max-width: 768px) 100vw, 50vw" /> : <div><span aria-hidden="true">✦</span><p>{t("dish.noRetainedPhoto")}</p></div>}</div>
    <div className="dish-detail-main"><span className="kicker">{dish.cuisine}</span><h1>{dish.name}</h1><p className="dish-restaurant">{dish.restaurantName ?? t("dish.noRestaurant")}{dish.restaurantLocality ? <span> · {dish.restaurantLocality}</span> : null}</p><p className="dish-description">{dish.description}</p>
      <div className="dish-contributor">{dish.contributorHandle ? <a href={`/profiles/${dish.contributorHandle}`}><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>{t("dish.sharedBy")}</small><b>{contributor}</b><em>@{dish.contributorHandle}</em></span></a> : <div><AppAvatar name={contributor} src={dish.contributorAvatarUrl} size="medium" /><span><small>{t("dish.sharedBy")}</small><b>{contributor}</b></span></div>}</div>
      <div className="dish-detail-actions"><LikeButton dishId={dish.id} initialCount={likeCount} /><a className="secondary compact-action button-link" href="#comments">◌ {commentCount} {t("comments.title")}</a><DishShareButton title={dish.name} /></div>
      <section className="dish-facts"><div className="section-heading"><div><span className="kicker">{t("dish.facts")}</span><h2>{t("dish.about")}</h2></div></div><dl><dt>{t("analysis.field.ingredients")}</dt><dd>{dish.ingredients || t("dish.notListed")}</dd><dt>{t("analysis.field.dietary")}</dt><dd>{dish.dietary || t("dish.notListed")}</dd>{price && <><dt>{t("dish.priceSeen")}</dt><dd>{price}</dd></>}<dt>{t("dish.menuStatus")}</dt><dd>{t(availabilityKey)}{dish.lastConfirmedAt ? ` · ${t("match.lastConfirmed", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(dish.lastConfirmedAt)) })}` : ""}</dd><dt>{t("dish.checkedBy")}</dt><dd>{t(`verification.${dish.verificationStatus}` as MessageKey)}</dd><dt>{t("dish.source")}</dt><dd>{t(`provenance.${dish.provenance}` as MessageKey)}</dd><dt>{t("dish.photoCheck")}</dt><dd>{dish.confidence}%</dd>{dish.restaurantName && <><dt>{t("publish.restaurantName")}</dt><dd>{dish.restaurantName}{dish.restaurantAddress ? ` · ${dish.restaurantAddress}` : ""}</dd></>}</dl></section>
      <DishOwnerControls dishId={dish.id} ownerId={dish.ownerId} /><SafetyActions targetType="dish" targetId={dish.id} userId={dish.ownerId} allowHide />
    </div></article>
    <section id="comments" className="dish-comments-block"><CommentSection dishId={dish.id} dishOwnerId={dish.ownerId} /></section>
    {related.length > 0 && <section className="related-dishes"><div className="section-heading"><div><span className="kicker">{t("nav.explore")}</span><h2>{t("dish.related")}</h2></div></div><div className="related-dish-grid">{related.map((item) => <a className="related-dish-card" href={`/dishes/${item.id}`} key={item.id}>{item.imageKey ? <Image src={`/api/media/${item.imageKey}`} alt="" width={480} height={360} sizes="(max-width: 768px) 100vw, 33vw" /> : <div className="related-placeholder" aria-hidden="true">✦</div>}<div><h3>{item.name}</h3><p>{item.description}</p></div></a>)}</div></section>}
  </PageContainer>;
}
