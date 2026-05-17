"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  swatches?: string[];
  onPick?: (color: string) => void;
};

const DEFAULT_SWATCHES = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
];

const HOLD_MS = 180;
const FAB_SIZE = 56;
const SWATCH_SIZE = 44;
const FINE_SIZE = 28;
const ARC_RADIUS = 130;
const FINE_RADIUS = 210;
const ARC_START_DEG = 180; // left
const ARC_END_DEG = 270; // up
const FINE_COUNT = 9;
const FINE_SPREAD_DEG = 60;
const EXPAND_THRESHOLD = ARC_RADIUS + 30;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hueShift(hex: string, deltaH: number): string {
  const [h, s, l] = hexToHsl(hex);
  return `hsl(${(h + deltaH + 360) % 360} ${s}% ${l}%)`;
}

export function ColorPickerFab({
  swatches = DEFAULT_SWATCHES,
  onPick,
}: Props) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const holdTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // Compute FAB centre in viewport coords (only when open).
  const fabCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const captureCenter = () => {
    const el = fabRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    fabCenter.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // Geometry derived from current pointer.
  const cx = fabCenter.current.x;
  const cy = fabCenter.current.y;
  const dx = pointer ? pointer.x - cx : 0;
  const dy = pointer ? pointer.y - cy : 0;
  const dist = Math.hypot(dx, dy);
  let pointerDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (pointerDeg < 0) pointerDeg += 360;

  // Map pointer angle to nearest swatch index when inside our arc.
  const inArc =
    open &&
    pointer !== null &&
    dist > FAB_SIZE / 2 &&
    pointerDeg >= ARC_START_DEG - 25 &&
    pointerDeg <= ARC_END_DEG + 25;

  let activeIdx = -1;
  if (inArc) {
    const step = (ARC_END_DEG - ARC_START_DEG) / (swatches.length - 1);
    const idx = Math.round((pointerDeg - ARC_START_DEG) / step);
    activeIdx = Math.max(0, Math.min(swatches.length - 1, idx));
  }

  const expanded = activeIdx >= 0 && dist > EXPAND_THRESHOLD;

  // Within the fine arc, pick which fine-hue dot is closest.
  let fineIdx = -1;
  if (expanded) {
    const step = (ARC_END_DEG - ARC_START_DEG) / (swatches.length - 1);
    const swatchDeg = ARC_START_DEG + activeIdx * step;
    const fineStart = swatchDeg - FINE_SPREAD_DEG / 2;
    const fineStep = FINE_SPREAD_DEG / (FINE_COUNT - 1);
    const idx = Math.round((pointerDeg - fineStart) / fineStep);
    fineIdx = Math.max(0, Math.min(FINE_COUNT - 1, idx));
  }

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
    if (activeIdx < 0) return;
    const base = swatches[activeIdx];
    if (expanded && fineIdx >= 0) {
      const delta = (fineIdx - (FINE_COUNT - 1) / 2) * 6;
      const c = hueShift(base, delta);
      setPicked(c);
      onPick?.(c);
    } else {
      setPicked(base);
      onPick?.(base);
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

  const swatchStep = (ARC_END_DEG - ARC_START_DEG) / (swatches.length - 1);

  return (
    <>
      {/* Selected colour readout */}
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

      {/* Overlay arcs — rendered in fixed coords from FAB centre */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="pointer-events-none fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Primary swatch ring */}
            {swatches.map((c, i) => {
              const deg = ARC_START_DEG + i * swatchStep;
              const { x, y } = polar(cx, cy, ARC_RADIUS, deg);
              const isActive = i === activeIdx;
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
                    scale: isActive ? 1.25 : 1,
                    opacity: 1,
                    transition: {
                      delay: i * 0.018,
                      type: "spring",
                      stiffness: 380,
                      damping: 26,
                    },
                  }}
                  exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                />
              );
            })}

            {/* Fine-hue arc that expands around the active swatch */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  key={`fine-${activeIdx}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {Array.from({ length: FINE_COUNT }).map((_, j) => {
                    const swatchDeg = ARC_START_DEG + activeIdx * swatchStep;
                    const fineStart = swatchDeg - FINE_SPREAD_DEG / 2;
                    const fineStep = FINE_SPREAD_DEG / (FINE_COUNT - 1);
                    const deg = fineStart + j * fineStep;
                    const { x, y } = polar(cx, cy, FINE_RADIUS, deg);
                    const delta = (j - (FINE_COUNT - 1) / 2) * 6;
                    const color = hueShift(swatches[activeIdx], delta);
                    const isActive = j === fineIdx;
                    return (
                      <motion.div
                        key={j}
                        className="absolute rounded-full ring-1 ring-foreground/10 shadow"
                        style={{
                          width: FINE_SIZE,
                          height: FINE_SIZE,
                          background: color,
                          left: x - FINE_SIZE / 2,
                          top: y - FINE_SIZE / 2,
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: isActive ? 1.35 : 1,
                          opacity: 1,
                          transition: {
                            delay: j * 0.012,
                            type: "spring",
                            stiffness: 420,
                            damping: 28,
                          },
                        }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.1 },
                        }}
                      />
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button
        ref={fabRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl ring-1 ring-foreground/10 touch-none select-none"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          background: picked ?? "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
        }}
        aria-label="Open colour picker"
      />
    </>
  );
}
