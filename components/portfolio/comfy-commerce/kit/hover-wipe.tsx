"use client";

import { useRef, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { gradientFor } from "./gradient";
import { HOVER_WIPE_SPRING } from "./motion";

// Ported from web/src/features/workflows/HoverWipe.tsx (with ThumbMedia.tsx for
// the Tripo card's looping clip): the workflow card's thumbnail.

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** The boundary at the right edge: the compare image fully hidden. */
export const HOVER_WIPE_HIDDEN = 100;

/**
 * A workflow thumbnail source: a lazy image, or for a video URL a muted,
 * looping, inline clip (the Tripo 3D card). `playing` false pauses a clip by
 * dropping autoplay; pass the demo's `active`.
 */
export function ThumbMedia({
  src,
  alt = "",
  poster,
  playing = true,
  className,
}: {
  src: string;
  alt?: string;
  poster?: string;
  playing?: boolean;
  className?: string;
}) {
  if (VIDEO_RE.test(src)) {
    return (
      <video
        key={playing ? "play" : "still"}
        src={src}
        poster={poster}
        autoPlay={playing}
        loop
        muted
        playsInline
        preload="metadata"
        draggable={false}
        aria-hidden
        className={className}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media
  return <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className={className} />;
}

/**
 * A thumbnail that wipes between a base image and a comparison as the pointer
 * moves across it: left of the pointer shows the base, right the compare. It
 * rests on the base. A gradientFor(seed) stands in when there is no base, and
 * with nothing to compare it is a plain thumbnail.
 *
 * The boundary is spring-driven (stiffness 300, damping 32): it eases in from
 * the right edge and tracks the pointer, and stays where it was when the
 * pointer leaves. Pass `target` (0–100) to script it from a demo; the spring
 * still smooths it. The product listens to mousemove; this listens to
 * pointermove, so a pen and a sideways finger drag also wipe (the hit area is
 * touch-action: pan-y, so vertical swipes still scroll).
 */
export function HoverWipe({
  base,
  compare,
  seed,
  alt = "",
  target: targetProp,
  poster,
  playing = true,
  className,
}: {
  base: string | null;
  compare: string | null;
  seed: string;
  alt?: string;
  target?: MotionValue<number>;
  /** Poster for a video base. */
  poster?: string;
  playing?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ownTarget = useMotionValue(HOVER_WIPE_HIDDEN);
  const target = targetProp ?? ownTarget;
  const pos = useSpring(target, HOVER_WIPE_SPRING);
  const clipPath = useTransform(pos, (p) => `inset(0 0 0 ${p}%)`);
  const dividerLeft = useTransform(pos, (p) => `${p}%`);
  const dividerOpacity = useTransform(pos, [86, HOVER_WIPE_HIDDEN], [1, 0]);
  const canWipe = Boolean(base && compare);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const percentFromLeft = ((event.clientX - rect.left) / rect.width) * 100;
    target.set(Math.min(HOVER_WIPE_HIDDEN, Math.max(0, percentFromLeft)));
  };

  const baseLayer = base ? (
    <ThumbMedia src={base} alt={alt} poster={poster} playing={playing} className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <div className="absolute inset-0" style={gradientFor(seed)} />
  );

  if (!canWipe) {
    return <div className={cn("relative h-full w-full overflow-hidden", className)}>{baseLayer}</div>;
  }

  return (
    // Sized to the thumbnail (what the wipe is measured against) but not
    // clipping, so the hover target below can spill past the edge.
    <div ref={ref} className={cn("relative h-full w-full select-none", className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {baseLayer}
        <motion.div className="absolute inset-0" style={{ clipPath }}>
          <ThumbMedia src={compare!} className="absolute inset-0 h-full w-full object-cover" />
        </motion.div>
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-px bg-white/90 shadow-(--shadow-lift)"
          style={{ left: dividerLeft, opacity: dividerOpacity }}
        />
      </div>
      {/* 15px past the left edge, so a small drift off that side doesn't drop
          the wipe; measured against the thumbnail, so it clamps to 0%. */}
      <div className="absolute top-0 right-0 bottom-0 -left-[15px] touch-pan-y" onPointerMove={moveTo} />
    </div>
  );
}
