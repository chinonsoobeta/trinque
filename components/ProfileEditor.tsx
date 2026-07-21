"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { PublicProfile } from "@/components/ProfileCard";

export function ProfileEditor({ profile }: { profile: PublicProfile }) {
  const { authHeaders } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  if (!editing) return <button className="secondary" onClick={() => setEditing(true)}>Edit profile</button>;

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus("Adding your photo…");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", headers: authHeaders(), body: form });
      const payload = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !payload.avatarUrl) { setStatus(payload.error ?? "We could not add your photo."); return; }
      setAvatarUrl(payload.avatarUrl); setStatus("Your photo was updated.");
    } finally { setBusy(false); event.target.value = ""; }
  }

  async function removeAvatar() {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) { setStatus("We could not remove your photo."); return; }
      setAvatarUrl(null); setStatus("Your photo was removed.");
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profile.handle)}`, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ displayName, handle, bio, location }) });
      const payload = await response.json() as { error?: string; profile?: { handle: string } };
      if (!response.ok || !payload.profile) { setStatus(payload.error ?? "We could not update your profile."); return; }
      if (payload.profile.handle !== profile.handle) window.location.replace(`/profiles/${payload.profile.handle}`);
      else window.location.reload();
    } finally { setBusy(false); }
  }

  return <form className="profile-editor" onSubmit={submit}>
    <div className="profile-avatar-editor">
      <div className="profile-avatar">{avatarUrl ? <Image src={avatarUrl} alt="Current avatar" width={128} height={128} sizes="128px" unoptimized /> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}</div>
      <label className="secondary avatar-upload">Add photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(event) => void uploadAvatar(event)} /></label>
      {avatarUrl && <button type="button" className="text-button" disabled={busy} onClick={() => void removeAvatar()}>Remove photo</button>}
    </div>
    <label>Display name<input maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
    <label>Handle<input maxLength={30} value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} /></label>
    <label>Bio<textarea maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
    <label>Location<input maxLength={100} value={location} onChange={(event) => setLocation(event.target.value)} /></label>
    <div><button className="primary" disabled={busy}>Save</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Cancel</button></div>
    {status && <p role="status">{status}</p>}
  </form>;
}
