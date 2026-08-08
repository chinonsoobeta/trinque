"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUiText } from "@/components/useUiText";

const OUTPUT_SIZE = 512;
const FRAME_SIZE = 240;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * A square crop, chosen by dragging and zooming rather than by whatever the
 * camera happened to frame.
 *
 * Uploading the file as chosen meant a portrait photo arrived as a portrait and
 * the round avatar took a band out of the middle of it — usually a chin. The
 * canvas here renders exactly what the circle shows, so what is confirmed is
 * what appears.
 */
export function AvatarCropper({ file, onCropped, onProblem }: { file: File; onCropped: (blob: Blob | null) => void; onProblem: (key: "onboarding.photoTooLarge" | "onboarding.photoUnsupported") => void }) {
  const t = useUiText();
  const frame = useRef<HTMLDivElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!ACCEPTED.has(file.type)) { onProblem("onboarding.photoUnsupported"); return; }
    if (file.size > MAX_INPUT_BYTES) { onProblem("onboarding.photoTooLarge"); return; }
    let active = true;
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => { if (!active) return; setImage(element); setZoom(1); setOffset({ x: 0, y: 0 }); };
    // Only a load this effect still owns may report a problem. Revoking the URL
    // makes the abandoned load fail, and without this guard that failure was
    // reported as "choose a JPEG, PNG, WebP or AVIF image" about a perfectly
    // good PNG.
    element.onerror = () => { if (active) onProblem("onboarding.photoUnsupported"); };
    element.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file, onProblem]);

  // The scale at which the shorter side exactly fills the frame; zoom multiplies
  // it, so 1 is always "fills the circle" no matter the photo's proportions.
  const baseScale = image ? FRAME_SIZE / Math.min(image.width, image.height) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback((next: { x: number; y: number }, currentScale: number) => {
    if (!image) return next;
    const slackX = Math.max(0, (image.width * currentScale - FRAME_SIZE) / 2);
    const slackY = Math.max(0, (image.height * currentScale - FRAME_SIZE) / 2);
    return { x: Math.max(-slackX, Math.min(slackX, next.x)), y: Math.max(-slackY, Math.min(slackY, next.y)) };
  }, [image]);

  const emit = useCallback((currentZoom: number, currentOffset: { x: number; y: number }) => {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE; canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) { onCropped(null); return; }
    // The frame is FRAME_SIZE on screen and OUTPUT_SIZE in the file, so every
    // on-screen measurement is multiplied by the same ratio.
    const ratio = OUTPUT_SIZE / FRAME_SIZE;
    const drawScale = baseScale * currentZoom * ratio;
    const width = image.width * drawScale;
    const height = image.height * drawScale;
    context.drawImage(image, (OUTPUT_SIZE - width) / 2 + currentOffset.x * ratio, (OUTPUT_SIZE - height) / 2 + currentOffset.y * ratio, width, height);
    canvas.toBlob((blob) => onCropped(blob), "image/jpeg", 0.9);
  }, [baseScale, image, onCropped]);

  useEffect(() => { if (image) emit(zoom, offset); }, [emit, image, offset, zoom]);

  function onPointerDown(event: React.PointerEvent) {
    drag.current = { x: offset.x, y: offset.y, startX: event.clientX, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent) {
    const start = drag.current;
    if (!start) return;
    setOffset(clamp({ x: start.x + (event.clientX - start.startX), y: start.y + (event.clientY - start.startY) }, scale));
  }
  function onPointerUp(event: React.PointerEvent) {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  // Arrow keys move the photo for anyone not using a pointer; the frame is a
  // control, so it takes focus and says what it does.
  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 20 : 5;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset((current) => clamp({ x: current.x + move.x, y: current.y + move.y }, scale));
  }

  if (!image) return null;
  return <div className="avatar-cropper">
    <div ref={frame} className="avatar-frame" role="group" tabIndex={0} aria-label={t("onboarding.cropHelp")}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
      style={{ width: FRAME_SIZE, height: FRAME_SIZE }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being positioned by hand; `next/image` would neither optimise nor size it. */}
      <img alt="" src={image.src} draggable={false} style={{ width: image.width * scale, height: image.height * scale, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} />
    </div>
    <label className="avatar-zoom">
      <span>{t("onboarding.cropZoom")}</span>
      <input type="range" min={1} max={3} step={0.01} value={zoom}
        onChange={(event) => { const next = Number(event.target.value); setZoom(next); setOffset((current) => clamp(current, baseScale * next)); }} />
    </label>
    <p className="privacy-note">{t("onboarding.cropHelp")}</p>
  </div>;
}
