"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/AppPrimitives";
import { useToast } from "@/components/ToastProvider";
import { useAnalytics } from "@/components/useAnalytics";
import { useUiLanguage, useUiText } from "@/components/useUiText";
import { groupConflictLabel, type GroupCandidate, type GroupSnapshot } from "@/components/group/types";
import type { MessageKey } from "@/ios/i18n";

/**
 * The shortlist, the votes and the locked plan. Candidates are grouped by how
 * well they fit the table's constraints, and a candidate that fits nobody is
 * still shown — with its conflicts — rather than silently dropped.
 */
export function GroupPlanView({ groupId }: { groupId: string }) {
  const { authHeaders, sessionToken } = useAuth();
  const sessionHeaders = useMemo(() => authHeaders(), [authHeaders]);
  const { flash } = useToast();
  const track = useAnalytics();
  const t = useUiText();
  const language = useUiLanguage();

  const [group, setGroup] = useState<GroupSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);

  useEffect(() => {
    void fetch("/api/health").then(async (response) => {
      const health = await response.json() as { capabilities?: { places?: { status?: string } } };
      setPlacesUnavailable(health.capabilities?.places?.status !== "available");
    }).catch(() => setPlacesUnavailable(true));
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    let active = true;
    void fetch(`/api/groups/${groupId}`, { headers: sessionHeaders })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) setGroup(((await response.json()) as { group: GroupSnapshot }).group);
        setLoaded(true);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [groupId, sessionHeaders, sessionToken]);

  async function groupAction(path: string, body?: object) {
    if (!sessionToken || !group) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${group.id}/${path}`, { method: "POST", headers: { ...sessionHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!response.ok) throw new Error();
      setGroup(((await response.json()) as { group: GroupSnapshot }).group);
      flash(path === "vote" ? t("group.voteSaved") : path === "finalize" ? t("group.finalized") : t("group.rsvpSaved"));
      if (path === "vote") track("vote_cast", { outcome: "success" });
      else if (path === "finalize") track("plan_finalized", { outcome: "success" });
      else if (path === "rsvp") track("rsvp_submitted", { outcome: "success" });
    } catch { flash(t("error.generic")); }
    finally { setBusy(false); }
  }

  async function downloadCalendar() {
    if (!sessionToken || !group) return;
    const response = await fetch(`/api/groups/${group.id}/calendar`, { headers: sessionHeaders });
    if (!response.ok) { flash(t("error.generic")); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url; link.download = "trinque-plan.ics"; link.click();
    URL.revokeObjectURL(url);
    flash(t("group.calendarDownloaded"));
  }

  if (!loaded) return <LoadingState label={t("group.eyebrow")} />;
  if (!group) return <section className="group-page"><div className="group-intro"><h1>{t("group.voteTitle")}</h1><p>{t("group.inviteInvalid")}</p><Link className="secondary" href="/groups">{t("group.createTitle")}</Link></div></section>;

  const tierOrder = { fits: 0, needs_checking: 1, does_not_fit: 2 };
  const sortedCandidates = [...group.candidates].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.score - a.score || a.distanceKm - b.distanceKm);
  const fitCandidates = sortedCandidates.filter((c) => c.tier === "fits").slice(0, 5);
  const checkCandidates = sortedCandidates.filter((c) => c.tier === "needs_checking").slice(0, 5);
  const noFitCandidates = sortedCandidates.filter((c) => c.tier === "does_not_fit").slice(0, 5);
  const winner = group.candidates.find((candidate) => candidate.candidateId === group.selectedCandidateId);

  const plan = group;
  function renderCandidate(candidate: GroupCandidate, index: number) {
    const distance = new Intl.NumberFormat(language, { style: "unit", unit: plan.distanceUnit === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(plan.distanceUnit === "imperial" ? candidate.distanceKm * .621371 : candidate.distanceKm);
    const canVote = candidate.tier !== "does_not_fit" && plan.status === "voting";
    const tierLabel = candidate.tier === "fits" ? t("group.fitEligible") : candidate.tier === "needs_checking" ? t("group.needsCheck") : t("group.hardConflict");
    const isWinner = candidate.candidateId === plan.selectedCandidateId;
    return <article className={`vote-card${isWinner ? " winner" : ""}${candidate.tier === "does_not_fit" ? " ineligible" : ""}`} key={candidate.candidateId}>
      <div className="vote-image" style={candidate.image ? { backgroundImage: `url(${candidate.image})` } : undefined}><span>{candidate.tier === "fits" ? `#${index + 1}` : "!"}</span></div>
      <div className="vote-copy">
        <div>
          <span>{tierLabel}</span>
          <h3>{candidate.restaurant}</h3>
          <p>{candidate.name} · {candidate.price} · {distance}</p>
          {candidate.conflicts.map((reason, i) => <small key={i}>{groupConflictLabel(t, reason)}</small>)}
          {candidate.kind === "provider_restaurant"
            ? <small>{t("match.restaurantReason")}</small>
            : <small>{`${t(`provenance.${candidate.provenance ?? "community_submitted"}` as MessageKey)} · ${t(`verification.${candidate.verificationStatus ?? "unverified"}` as MessageKey)}`} · {candidate.currentAvailabilityConfirmed ? t("availability.confirmed") : t("availability.unknown")}</small>}
          <small>{candidate.dietaryCaveat === "provider_information_unconfirmed" ? t("group.providerCaveat") : t("analysis.warning")}</small>
        </div>
        {canVote && <button disabled={busy || plan.status === "finalized"} aria-label={t("group.voteFor", { name: candidate.restaurant })} onClick={() => void groupAction("vote", { candidateId: candidate.candidateId })}><Icon name="arrowUp" size={16} /> <b>{plan.votes[candidate.candidateId] ?? 0}</b></button>}
      </div>
    </article>;
  }

  const constraints: Array<[MessageKey, string, string]> = [
    ["group.radius", group.locality ?? group.neighborhood, new Intl.NumberFormat(language, { style: "unit", unit: group.distanceUnit === "imperial" ? "mile" : "kilometer", unitDisplay: "short", maximumFractionDigits: 1 }).format(group.distanceUnit === "imperial" ? group.maxDistanceKm * .621371 : group.maxDistanceKm)],
    ["group.budget", new Intl.NumberFormat(group.locale ?? language, { style: "currency", currency: group.currencyCode ?? "CAD", maximumFractionDigits: 0 }).format(group.budgetMax), t("group.budget")],
    ["group.allergies", group.allergies.join(", ") || "–", t("group.allergies")],
  ];

  return <section className="group-page">
    <div className="group-intro">
      <div className="eyebrow"><Icon name="groups" size={16} /> {t("group.eyebrow")}</div>
      <h1>{group.status === "finalized" ? t("group.finalTitle") : t("group.voteTitle")}</h1>
      <p>{t("group.constraints")}</p>
      {placesUnavailable && <p className="location-status warning">{t("match.providerUnavailable")}</p>}
      <div className="members"><span>{t("group.memberCount", { count: group.memberCount })}</span></div>
    </div>
    <div className="planner">
      <aside className="constraints">
        <span className="kicker">{new Intl.DateTimeFormat(language, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: group.timeZone ?? "UTC" }).format(new Date(group.eventTime))}</span>
        <h2>{group.name}</h2>
        {constraints.map(([label, title, note], index) => <div className={index === 2 && group.allergies.length ? "constraint warning" : "constraint"} key={label}>
          <Icon name={index === 0 ? "location" : index === 1 ? "wallet" : "alert"} size={18} />
          <div><b>{title}</b><small>{note}</small></div>
        </div>)}
        {group.viewerRole === "owner" && <>
          <Link className="secondary full" href={`/groups?from=${group.id}`}>{t("group.changePlan")}</Link>
          {!group.inviteRevokedAt && <>
            <button className="secondary full" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/groups?join=${group.inviteCode}`); flash(t("group.inviteCopied")); }}>{t("group.copyInvite")}</button>
            <button className="text-button full" onClick={() => void groupAction("invite/revoke")}>{t("group.revokeInvite")}</button>
          </>}
        </>}
      </aside>
      <div className="shortlist">
        <div className="section-heading"><div><span className="kicker">{t("group.ranking")}</span><h2>{group.status === "voting" ? t("group.bestFits") : t("group.finalPlan")}</h2></div></div>
        {sortedCandidates.length === 0 && <p className="empty-tier">{t("group.noLiveCandidates")}</p>}
        {sortedCandidates.length > 0 && fitCandidates.length === 0 && checkCandidates.length === 0 && <p className="empty-tier">{t("group.noEligibleCandidates")}</p>}
        {fitCandidates.map((c, i) => renderCandidate(c, i))}
        {checkCandidates.length > 0 && <><div className="section-heading shortlist-secondary"><div><span className="kicker">{t("group.ranking")}</span><h2>{t("group.placesToCheck")}</h2></div></div>{checkCandidates.map((c, i) => renderCandidate(c, i))}</>}
        {noFitCandidates.length > 0 && <><div className="section-heading shortlist-secondary"><div><span className="kicker">{t("group.ranking")}</span><h2>{t("group.noFit")}</h2></div></div>{noFitCandidates.map((c, i) => renderCandidate(c, i))}</>}
        {group.status === "voting" && group.viewerRole === "owner"
          ? <button className="primary plan-button" disabled={busy} onClick={() => void groupAction("finalize")}>{t("group.lock")}</button>
          : group.status === "voting"
            ? <p className="privacy-note">{t("group.ownerFinalizes")}</p>
            : winner
              ? <div className="final-plan">
                <span><Icon name="sparkle" size={16} /> {t("group.bestTable")}</span>
                <h3>{winner.restaurant}</h3>
                <p>{winner.name} · {new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone: group.timeZone ?? "UTC" }).format(new Date(group.eventTime))}</p>
                <div>
                  <button className="primary" disabled={busy} onClick={() => void groupAction("rsvp", { status: "yes" })}>{t("group.rsvpYes")} · {group.rsvps.yes ?? 0}</button>
                  <button className="secondary" onClick={() => void downloadCalendar()}>{t("group.calendar")}</button>
                </div>
              </div>
              : null}
      </div>
    </div>
  </section>;
}
