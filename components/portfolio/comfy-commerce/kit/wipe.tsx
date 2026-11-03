"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { ArrowLeftRight, IconBox } from "./icons";
import { TouchClaim, touchClaim } from "./interact";

// The review lightbox's wipe, ported from web/src/features/review/CompareMedia.tsx
// (Wipe, :128): the after image clipped to the right of a 1px white divider
// with a round grab handle, "Before" and "After" captions in the top corners.

/**
 * The lightbox caption pill (CompareMedia's CAPTION): 24px, ink at 70% under a
 * light blur, white 14px text. Also the "Source" / "New" labels.
 */
export const CAPTION =
  "flex h-6 items-center gap-1 rounded-lg bg-(--ink)/70 px-2 text-sm text-white backdrop-blur-sm";

export interface WipeImage {
  src: string;
  alt: string;
}

/** Pixels a finger may drift before a press is no longer a tap. */
const TAP_SLOP = 10;

/**
 * Draggable wipe comparison: after revealed right of the divider. It fills its
 * parent; size the parent to the before image's ratio (a .cc-fit-box), as the
 * product lets the before image size the box.
 *
 * `pos` (0–100, % from the left) is a MotionValue so a demo can script the
 * sweep with animate(pos, …) without re-rendering; pass none to keep it
 * inside. A press anywhere moves the divider there and drags it (pointer
 * capture), as in the product. Ported differences: the product's box is
 * touch-none; here it is touch-action: pan-y, so a vertical swipe still
 * scrolls the page and a finger takes the divider only once it moves sideways
 * (a tap still jumps it). And the handle is a keyboard slider (arrows ±2,
 * Shift ±10, Home/End), which the product's is not.
 */
export function Wipe({
  before,
  after,
  labels = ["Before", "After"],
  pos: posProp,
  defaultPos = 50,
  onInteract,
  sliderLabel = "Wipe between before and after",
  loading = "eager",
  className,
  children,
}: {
  before: WipeImage;
  after: WipeImage;
  /** The two captions; the product shows "Source" / "New" for added media. */
  labels?: readonly [string, string];
  pos?: MotionValue<number>;
  defaultPos?: number;
  /** Called on the first press or key on the wipe: stop autoplay, fade a hint. */
  onInteract?: () => void;
  sliderLabel?: string;
  loading?: "eager" | "lazy";
  className?: string;
  /** Drawn over the media (under the divider), e.g. an extra badge. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ownPos = useMotionValue(defaultPos);
  const pos = posProp ?? ownPos;
  const clipPath = useTransform(pos, (p) => `inset(0 0 0 ${p}%)`);
  const left = useTransform(pos, (p) => `${p}%`);
  const [now, setNow] = useState(() => Math.round(pos.get()));
  useMotionValueEvent(pos, "change", (p) => setNow(Math.round(p)));
  const press = useRef<{ id: number; claim: TouchClaim | null; x: number; y: number; captured: boolean } | null>(null);

  const moveTo = useCallback(
    (clientX: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      pos.stop();
      pos.set(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
    },
    [pos],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const claim = touchClaim(event);
    press.current = { id: event.pointerId, claim, x: event.clientX, y: event.clientY, captured: false };
    if (claim) return; // a finger waits until it moves sideways (or lifts as a tap)
    onInteract?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current.captured = true;
    moveTo(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.claim) {
      if (!p.claim.move(event.clientX, event.clientY)) return;
      if (!p.captured) {
        onInteract?.();
        event.currentTarget.setPointerCapture(event.pointerId);
        p.captured = true;
      }
    }
    moveTo(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.claim && !p.claim.claimed && Math.hypot(event.clientX - p.x, event.clientY - p.y) < TAP_SLOP) {
      onInteract?.();
      moveTo(event.clientX);
    }
    press.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const big = event.shiftKey ? 10 : 2;
    const current = pos.get();
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - big;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + big;
    else if (event.key === "PageDown") next = current - 10;
    else if (event.key === "PageUp") next = current + 10;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onInteract?.();
    pos.stop();
    pos.set(Math.min(100, Math.max(0, Math.round(next))));
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (press.current = null)}
      className={cn(
        "relative h-full w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-xl bg-(--surface-2) select-none",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media, sized by its box */}
      <img src={before.src} alt={before.alt} draggable={false} loading={loading} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media, sized by its box */}
        <img src={after.src} alt={after.alt} draggable={false} loading={loading} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </motion.div>
      {children}
      <span aria-hidden className={cn(CAPTION, "absolute top-3 left-3")}>
        {labels[0]}
      </span>
      <span aria-hidden className={cn(CAPTION, "absolute top-3 right-3")}>
        {labels[1]}
      </span>
      <motion.div className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-(--shadow-lift)" style={{ left }}>
        <span
          role="slider"
          tabIndex={0}
          aria-label={sliderLabel}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={now}
          aria-valuetext={`${100 - now}% after`}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-[40px] border border-(--line) bg-(--surface) text-(--ink) shadow-(--shadow-lift)"
        >
          <IconBox>
            <ArrowLeftRight />
          </IconBox>
        </span>
      </motion.div>
    </div>
  );
}
