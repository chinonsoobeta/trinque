"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SafetyActions } from "@/components/SafetyActions";
import { useUiText } from "@/components/useUiText";

type Comment = { id: string; userId: string; body: string; createdAt: string; updatedAt: string; displayName: string | null; handle: string | null; avatarUrl: string | null };

export function CommentSection({ dishId, dishOwnerId }: { dishId: string; dishOwnerId: string }) {
  const { authenticated, identity, authHeaders } = useAuth();
  const t = useUiText();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; void fetch(`/api/dishes/${encodeURIComponent(dishId)}/comments`).then((response) => response.json()).then((payload: { comments?: Comment[] }) => { if (active) setComments(payload.comments ?? []); }).catch(() => setStatus(t("comments.unavailable"))).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [dishId, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (!text || text.length > 1000) return;
    const tempId = `pending-${Date.now()}`;
    const optimistic: Comment = { id: tempId, userId: identity?.id ?? "", body: text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), displayName: identity?.displayName ?? t("comments.you"), handle: null, avatarUrl: null };
    setComments((current) => [optimistic, ...current]); setBody(""); setStatus("");
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}/comments`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      if (!response.ok) throw new Error("comment failed");
      const payload = await response.json() as { comment: Comment };
      setComments((current) => current.map((comment) => comment.id === tempId ? payload.comment : comment));
    } catch {
      setComments((current) => current.filter((comment) => comment.id !== tempId)); setBody(text); setStatus(t("comments.postFailed"));
    }
  }

  async function remove(commentId: string) {
    const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE", headers: authHeaders() });
    if (response.ok) setComments((current) => current.filter((comment) => comment.id !== commentId));
    else setStatus(t("safety.failed"));
  }

  return <section className="comment-section"><h2>{t("comments.title")}</h2>{loading && <p>{t("comments.loading")}</p>}<form onSubmit={submit}><textarea maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={authenticated ? t("comments.add") : t("comments.signIn")} /><button className="primary" disabled={!body.trim()}>{t("comments.post")}</button></form>{status && <p role="status">{status}</p>}<div>{comments.map((comment) => <article key={comment.id}><b>{comment.displayName ?? t("comments.member")}</b>{comment.handle && <span> @{comment.handle}</span>}<p>{comment.body}</p><small>{new Date(comment.createdAt).toLocaleString()}</small><SafetyActions targetType="comment" targetId={comment.id} userId={comment.userId} />{authenticated && (identity?.id === comment.userId || identity?.id === dishOwnerId) && <button className="text-button" onClick={() => void remove(comment.id)}>{t("safety.removeComment")}</button>}</article>)}</div></section>;
}
