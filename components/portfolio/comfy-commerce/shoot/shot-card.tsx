"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useMotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react";

import type { CcImage } from "@/lib/comfy-commerce/media";
import { cn } from "@/lib/utils";

import { TouchClaim, touchClaim } from "../kit/interact";
import { HOVER_WIPE_SPRING } from "../kit/motion";
import { STATUS_STYLES } from "../kit/status-chip";
import { ACTION_LABEL } from "./data";

// A staged shot drawn as the product draws a workflow card: WorkflowCard's 4:3
// tile with the white title panel floated 4px in (web/src/features/workflows/
// WorkflowCard.tsx), over HoverWipe's spring wipe (HoverWipe.tsx). The base is
// the flat-lay and the comparison is the shot, as the Nano Banana 2 Generic
// card pairs them, so left of the pointer is the source and right of it the
// result, as in the review lightbox. The panel's second line is ReviewCard's
// status dot and action label. The pairing of the run with these cards is the
// tile's own: in the product the three results go to Review & publish.

/** The boundary at the right edge: the shot fully hidden behind the flat-lay. */
const HIDDEN = 100;
/** The boundary at the left edge: the shot fully shown, where a staged card comes to rest. */
const SHOWN = 0;
/** Pixels a finger may drift before a press is no longer a tap. */
const TAP_SLOP = 10;

/**
 * One shot. Before its output is staged it shows the flat-lay under a veil
 * with "Generating…"; when `staged` turns true the shot wipes in from the right
 * on HoverWipe's spring and the card becomes a wipe: the boundary follows a
 * mouse or pen as it moves (and stays where it left, as in the product), a
 * finger takes it on a sideways drag or a tap (vertical swipes scroll the
 * page), and the card is a keyboard slider (arrows ±2, Shift ±10, Home/End).
 */
export function ShotCard({
  title,
  source,
  shot,
  staged,
  reducedMotion = false,
  onInteract,
  className,
}: {
  title: string;
  source: CcImage;
  shot: CcImage;
  staged: boolean;
  reducedMotion?: boolean;
  /** The first time a person moves the wipe (fade the hint). */
  onInteract?: () => void;
  className?: string;
}) {
  const hit = useRef<HTMLDivElement>(null);
  const target = useMotionValue(staged ? SHOWN : HIDDEN);
  const sprung = useSpring(target, HOVER_WIPE_SPRING);
  // Reduced motion: the boundary goes straight where it is sent.
  const pos = reducedMotion ? target : sprung;
  const clipPath = useTransform(pos, (p) => `inset(0 0 0 ${p}%)`);
  const dividerLeft = useTransform(pos, (p) => `${p}%`);
  // The product fades the line out over the last 14% before the right edge,
  // where its cards rest. These cards rest at the left edge, so it fades there too.
  const dividerOpacity = useTransform(pos, [SHOWN, 14, 86, HIDDEN], [0, 1, 1, 0]);
  const [now, setNow] = useState(() => Math.round(target.get()));
  useMotionValueEvent(target, "change", (p) => setNow(Math.round(p)));

  // Staging sends the boundary to the left edge (the shot wipes in); a replay sends it back.
  useEffect(() => {
    target.set(staged ? SHOWN : HIDDEN);
  }, [staged, target]);

  const press = useRef<{ id: number; claim: TouchClaim | null; x: number; y: number; captured: boolean } | null>(null);

  const moveTo = (clientX: number) => {
    const rect = hit.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // Measured against the thumbnail, not the hit area that spills 15px past its left edge.
    const left = rect.left + 15;
    const width = rect.width - 15;
    target.set(Math.min(HIDDEN, Math.max(SHOWN, ((clientX - left) / width) * 100)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!staged) return;
    const claim = touchClaim(event);
    press.current = { id: event.pointerId, claim, x: event.clientX, y: event.clientY, captured: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!staged) return;
    if (event.pointerType !== "touch") {
      // A mouse or pen wipes as it moves, pressed or not (the product's onMouseMove).
      onInteract?.();
      moveTo(event.clientX);
      return;
    }
    const p = press.current;
    if (!p || p.id !== event.pointerId || !p.claim) return;
    if (!p.claim.move(event.clientX, event.clientY)) return;
    if (!p.captured) {
      onInteract?.();
      event.currentTarget.setPointerCapture(event.pointerId);
      p.captured = true;
    }
    moveTo(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== event.pointerId) return;
    press.current = null;
    if (p.claim && !p.claim.claimed && Math.hypot(event.clientX - p.x, event.clientY - p.y) < TAP_SLOP) {
      onInteract?.();
      moveTo(event.clientX);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!staged) return;
    const step = event.shiftKey ? 10 : 2;
    const current = target.get();
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + step;
    else if (event.key === "PageDown") next = current - 10;
    else if (event.key === "PageUp") next = current + 10;
    else if (event.key === "Home") next = SHOWN;
    else if (event.key === "End") next = HIDDEN;
    if (next === null) return;
    event.preventDefault();
    onInteract?.();
    target.set(Math.min(HIDDEN, Math.max(SHOWN, Math.round(next))));
  };

  const status = STATUS_STYLES.pending;

  return (
    <article
      role="slider"
      tabIndex={staged ? 0 : -1}
      aria-label={`${title}: wipe between the flat-lay and the shot`}
      aria-disabled={!staged || undefined}
      aria-orientation="horizontal"
      aria-valuemin={SHOWN}
      aria-valuemax={HIDDEN}
      aria-valuenow={now}
      aria-valuetext={staged ? `${100 - now}% shot, ${now}% flat-lay` : "Generating"}
      onKeyDown={onKeyDown}
      className={cn(
        "@container/shot relative aspect-[4/3] min-w-0 rounded-2xl border border-(--line) bg-(--surface-2) select-none",
        className,
      )}
    >
      {/* The thumbnail: sized to the card, clipping only the picture so the hit area can spill past it. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media */}
        <img
          src={source.src}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <motion.div className="absolute inset-0" style={{ clipPath }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media */}
          <img src={shot.src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        </motion.div>
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-px bg-white/90 shadow-(--shadow-lift)"
          style={{ left: dividerLeft, opacity: dividerOpacity }}
        />
        {/* Waiting for its output: the flat-lay, dimmed. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 bg-(--surface)/40 transition-opacity duration-500 ease-out motion-reduce:transition-none",
            staged && "opacity-0",
          )}
        />
      </div>

      {/* The hover target, 15px past the left edge so a small drift off that side doesn't drop the wipe. */}
      <div
        ref={hit}
        className={cn("absolute top-0 right-0 bottom-0 -left-[15px] touch-pan-y", staged && "cursor-ew-resize")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (press.current = null)}
      />

      {/* The white panel floating 4px over the bottom of the thumbnail; the wipe tracks underneath. */}
      <div className="pointer-events-none absolute inset-x-1 bottom-1 rounded-xl bg-(--surface) px-3 py-2 @max-[219px]/shot:px-2.5 @max-[219px]/shot:py-1.5">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-(--ink-faint) @max-[199px]/shot:hidden">
          {staged ? (
            <>
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", status.dot)} />
              <span className="truncate">{ACTION_LABEL}</span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="inline-block size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-(--line-strong) border-t-(--accent)"
              />
              <span className="truncate">Generating…</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}

/** The flat-lay the run started from, as a plain card (no comparison): shown where the grid has a fourth cell. */
export function SourceCard({ productTitle, source, className }: { productTitle: string; source: CcImage; className?: string }) {
  return (
    <article className={cn("@container/shot relative aspect-[4/3] min-w-0 rounded-2xl border border-(--line) bg-(--surface-2)", className)}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media */}
        <img src={source.src} alt={source.alt} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="absolute inset-x-1 bottom-1 rounded-xl bg-(--surface) px-3 py-2 @max-[219px]/shot:px-2.5 @max-[219px]/shot:py-1.5">
        {/* The lightbox's caption for an add's left-hand image (CompareMedia.tsx). */}
        <p className="truncate text-sm font-medium">Source</p>
        <p className="mt-0.5 truncate text-sm text-(--ink-faint) @max-[199px]/shot:hidden">{productTitle}</p>
      </div>
    </article>
  );
}
