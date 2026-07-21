"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Comment = { id: string; userId: string; body: string; createdAt: string; updatedAt: string; displayName: string | null; handle: string | null; avatarUrl: string | null };

export function CommentSection({ dishId }: { dishId: string }) {
  const { authenticated, identity, authHeaders } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; void fetch(`/api/dishes/${encodeURIComponent(dishId)}/comments`).then((response) => response.json()).then((payload: { comments?: Comment[] }) => { if (active) setComments(payload.comments ?? []); }).catch(() => setStatus("Comments are not available now.")).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [dishId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!authenticated) { window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (!text || text.length > 1000) return;
    const tempId = `pending-${Date.now()}`;
    const optimistic: Comment = { id: tempId, userId: identity?.id ?? "", body: text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), displayName: identity?.displayName ?? "You", handle: null, avatarUrl: null };
    setComments((current) => [optimistic, ...current]); setBody(""); setStatus("");
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dishId)}/comments`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      if (!response.ok) throw new Error("comment failed");
      const payload = await response.json() as { comment: Comment };
      setComments((current) => current.map((comment) => comment.id === tempId ? payload.comment : comment));
    } catch {
      setComments((current) => current.filter((comment) => comment.id !== tempId)); setBody(text); setStatus("We could not post your comment.");
    }
  }

  return <section className="comment-section"><h2>Comments</h2>{loading && <p>Loading comments…</p>}<form onSubmit={submit}><textarea maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={authenticated ? "Add a comment" : "Sign in to comment"} /><button className="primary" disabled={!body.trim()}>Post</button></form>{status && <p role="status">{status}</p>}<div>{comments.map((comment) => <article key={comment.id}><b>{comment.displayName ?? "Trinque member"}</b>{comment.handle && <span> @{comment.handle}</span>}<p>{comment.body}</p><small>{new Date(comment.createdAt).toLocaleString()}</small></article>)}</div></section>;
}
