"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  swatches?: string[];
  onPick?: (color: string) => void;
};

const DEFAULT_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

const HOLD_MS = 180;
const FAB_SIZE = 56;
const SWATCH_SIZE = 40;
const ARC_RADIUS = 104;
const RIBBON_INNER = 128;
const RIBBON_OUTER = 162;
const RIBBON_MID = (RIBBON_INNER + RIBBON_OUTER) / 2;
const INDICATOR_SIZE = 30;
const ARC_START_DEG = 180; // math: left
const ARC_END_DEG = 270; // math: up
const ARC_SPAN = ARC_END_DEG - ARC_START_DEG;
const EXPAND_THRESHOLD = ARC_RADIUS + 14;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// 13 hue stops across the arc → smooth conic rainbow
const HUE_STOPS = Array.from({ length: 13 }, (_, i) => {
  const hue = (i * 360) / 12;
  const deg = (i * ARC_SPAN) / 12;
  return `hsl(${hue} 100% 55%) ${deg}deg`;
}).join(", ");

export function ColorPickerFabV2({
  swatches = DEFAULT_SWATCHES,
  onPick,
}: Props) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const holdTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const fabCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const captureCenter = () => {
    const el = fabRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    fabCenter.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const cx = fabCenter.current.x;
  const cy = fabCenter.current.y;
  const dx = pointer ? pointer.x - cx : 0;
  const dy = pointer ? pointer.y - cy : 0;
  const dist = Math.hypot(dx, dy);
  let pointerDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (pointerDeg < 0) pointerDeg += 360;

  const inArc =
    open &&
    pointer !== null &&
    dist > FAB_SIZE / 2 &&
    pointerDeg >= ARC_START_DEG - 25 &&
    pointerDeg <= ARC_END_DEG + 25;

  let activeIdx = -1;
  if (inArc) {
    const step = ARC_SPAN / (swatches.length - 1);
    const idx = Math.round((pointerDeg - ARC_START_DEG) / step);
    activeIdx = Math.max(0, Math.min(swatches.length - 1, idx));
  }

  const expanded = inArc && dist > EXPAND_THRESHOLD;

  // Hue value when on ribbon: clamp pointer angle within arc, map to 0..360.
  let ribbonHue = 0;
  if (expanded) {
    const clamped = Math.max(ARC_START_DEG, Math.min(ARC_END_DEG, pointerDeg));
    const t = (clamped - ARC_START_DEG) / ARC_SPAN;
    ribbonHue = t * 360;
  }
  const ribbonColor = `hsl(${ribbonHue} 100% 55%)`;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    captureCenter();
    setPicked(null);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    holdTimer.current = window.setTimeout(() => {
      setOpen(true);
      setPointer({ x: e.clientX, y: e.clientY });
    }, HOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!open) return;
    setPointer({ x: e.clientX, y: e.clientY });
  };

  const commitPick = () => {
    if (expanded) {
      setPicked(ribbonColor);
      onPick?.(ribbonColor);
      return;
    }
    if (activeIdx >= 0) {
      const c = swatches[activeIdx];
      setPicked(c);
      onPick?.(c);
    }
  };

  const handlePointerUp = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (open) commitPick();
    setOpen(false);
    setPointer(null);
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const swatchStep = ARC_SPAN / (swatches.length - 1);

  // Indicator position along ribbon centerline.
  const indicatorDeg = expanded
    ? Math.max(ARC_START_DEG, Math.min(ARC_END_DEG, pointerDeg))
    : 0;
  const indicatorPos = expanded ? polar(cx, cy, RIBBON_MID, indicatorDeg) : null;

  return (
    <>
      <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-background/80 px-4 py-2 font-mono text-xs backdrop-blur">
        {picked ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full ring-1 ring-foreground/20"
              style={{ background: picked }}
            />
            {picked}
          </span>
        ) : (
          <span className="text-muted-foreground">press &amp; hold</span>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="pointer-events-none fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Soft vignette focused around FAB */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle ${RIBBON_OUTER + 80}px at ${cx}px ${cy}px, rgba(0,0,0,0) 40%, rgba(0,0,0,0.28) 100%)`,
              }}
            />

            {/* Continuous hue ribbon */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  key="ribbon"
                  className="absolute"
                  style={{
                    width: 2 * RIBBON_OUTER,
                    height: 2 * RIBBON_OUTER,
                    left: cx - RIBBON_OUTER,
                    top: cy - RIBBON_OUTER,
                    background: `conic-gradient(from 270deg, ${HUE_STOPS}, transparent ${ARC_SPAN}deg 360deg)`,
                    WebkitMask: `radial-gradient(circle, transparent 0 ${RIBBON_INNER - 0.5}px, black ${RIBBON_INNER}px ${RIBBON_OUTER}px, transparent ${RIBBON_OUTER + 0.5}px)`,
                    mask: `radial-gradient(circle, transparent 0 ${RIBBON_INNER - 0.5}px, black ${RIBBON_INNER}px ${RIBBON_OUTER}px, transparent ${RIBBON_OUTER + 0.5}px)`,
                    filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.25))",
                  }}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    transition: { type: "spring", stiffness: 320, damping: 26 },
                  }}
                  exit={{
                    scale: 0.9,
                    opacity: 0,
                    transition: { duration: 0.14 },
                  }}
                />
              )}
            </AnimatePresence>

            {/* Primary swatch ring */}
            {swatches.map((c, i) => {
              const deg = ARC_START_DEG + i * swatchStep;
              const { x, y } = polar(cx, cy, ARC_RADIUS, deg);
              const isActive = !expanded && i === activeIdx;
              return (
                <motion.div
                  key={c}
                  className="absolute rounded-full ring-1 ring-foreground/10 shadow-lg"
                  style={{
                    width: SWATCH_SIZE,
                    height: SWATCH_SIZE,
                    background: c,
                    left: x - SWATCH_SIZE / 2,
                    top: y - SWATCH_SIZE / 2,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: isActive ? 1.2 : 1,
                    opacity: expanded ? 0.55 : 1,
                    transition: {
                      delay: i * 0.016,
                      type: "spring",
                      stiffness: 380,
                      damping: 26,
                    },
                  }}
                  exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                />
              );
            })}

            {/* Ribbon indicator */}
            <AnimatePresence>
              {expanded && indicatorPos && (
                <motion.div
                  key="indicator"
                  className="absolute rounded-full ring-2 ring-white shadow-xl"
                  style={{
                    width: INDICATOR_SIZE,
                    height: INDICATOR_SIZE,
                    background: ribbonColor,
                    left: indicatorPos.x - INDICATOR_SIZE / 2,
                    top: indicatorPos.y - INDICATOR_SIZE / 2,
                  }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 480, damping: 30 }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={fabRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-5 right-5 z-50 rounded-full shadow-xl ring-1 ring-foreground/10 touch-none select-none"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          background:
            picked ??
            "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
        }}
        aria-label="Open colour picker"
      />
    </>
  );
}
