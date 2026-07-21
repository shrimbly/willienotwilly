"use client";

import type { ReactNode, Ref } from "react";

import { EVENT_SYMBOL, TOKENS } from "./types";
import type { Rect } from "./types";

// Grows in step with the cell the renderer pops beneath it.
const HOVER_SCALE = 1.7;
// Fraction of the (square) cell the symbol box occupies — a bit smaller so it
// sits comfortably inside its cell.
const SIZE_FRAC = 0.6;
// Monochrome, theme only. A marker on an elapsed (bright) cell is dark; on an
// unlived (dark) cell it is light — so the glyph reads either way, no backdrop.
const INK_LIVED = TOKENS.bg;
const INK_FUTURE = TOKENS.text;

const R = 9; // filled-dot radius (record ●) in the 24-unit viewBox — shared footprint
const SW = 3; // stroke width for hollow shapes
const D = 9.5; // solid-diamond half-diagonal (crossroad ◆)
const DH = 8; // hollow-diamond half-diagonal (prediction ◇); the stroke pushes tips out to ~R
const AW = 2.6; // asterisk stroke width (estimate ✱)
const SPOKE = 7.7; // asterisk half-length — round caps carry the tips out to ~R

// Three lines at 30°/90°/150° make a six-spoke asterisk with one spoke pointing
// up. Each line runs tip-to-tip through the centre. (SVG y is down.)
const ASTERISK = [30, 90, 150].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const dx = SPOKE * Math.cos(a);
  const dy = SPOKE * Math.sin(a);
  return { x1: 12 + dx, y1: 12 - dy, x2: 12 - dx, y2: 12 + dy };
});

// The four symbols as centred SVG shapes (currentColor = the adaptive ink):
// ● record, ✱ estimate, ◇ probability (hollow diamond), ◆ crossroad.
const SHAPES: Record<string, ReactNode> = {
  [EVENT_SYMBOL.record]: <circle cx="12" cy="12" r={R} fill="currentColor" />,
  [EVENT_SYMBOL.estimate]: (
    <>
      {ASTERISK.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="currentColor"
          strokeWidth={AW}
          strokeLinecap="round"
        />
      ))}
    </>
  ),
  [EVENT_SYMBOL.probability]: (
    <path
      d={`M12 ${12 - DH} L${12 + DH} 12 L12 ${12 + DH} L${12 - DH} 12 Z`}
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinejoin="round"
    />
  ),
  [EVENT_SYMBOL.crossroad]: (
    <path
      d={`M12 ${12 - D} L${12 + D} 12 L12 ${12 + D} L${12 - D} 12 Z`}
      fill="currentColor"
    />
  ),
};

export interface MarkerIcon {
  id: string;
  /** The glyph to draw — ● record, ✱ estimate, ◇ probability, ◆ crossroad. */
  symbol: string;
  /** true when the event's cell is already lived (a bright cell). */
  lived: boolean;
  /** Cell centre in layout px, relative to the clock container. */
  x: number;
  y: number;
}

export interface MarkerIconsProps {
  icons: MarkerIcon[];
  /** The (square) cell size in px. */
  size: number;
  /** Shown only once settled in LIFE; fades with the grid on a morph. */
  visible: boolean;
  hoveredId: string | null;
  reducedMotion: boolean;
  /**
   * The stage rect (layout px). Markers are clipped to it and drawn relative to
   * its origin, so a scrolled overlay clips at the frame instead of over the HUD.
   */
  clip: Rect;
  /**
   * The translated inner layer, moved imperatively with the LIFE scroll offset.
   */
  innerRef?: Ref<HTMLDivElement>;
}

/**
 * The life-event markers, as minimal symbols pinned to their week cells on the
 * LIFE grid — drawn as centred SVG shapes (not font glyphs, which sit off-centre
 * and vary by fallback font). A DOM overlay with pointer-events off, so the
 * canvas underneath still hit-tests hovers. The symbol grades the nature of the
 * claim (see EVENT_SYMBOL); the card carries the specifics.
 */
export function MarkerIcons({
  icons,
  size,
  visible,
  hoveredId,
  reducedMotion,
  clip,
  innerRef,
}: MarkerIconsProps) {
  const box = Math.max(5, Math.round(size * SIZE_FRAC));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 overflow-hidden"
      style={{
        left: clip.x,
        top: clip.y,
        width: clip.w,
        height: clip.h,
        opacity: visible ? 1 : 0,
        transition: reducedMotion
          ? "none"
          : `opacity ${visible ? 180 : 90}ms linear`,
      }}
    >
      {/* Translated imperatively with the LIFE scroll; identity otherwise. */}
      <div ref={innerRef} className="absolute inset-0" style={{ willChange: "transform" }}>
        {icons.map((m) => {
          const hot = m.id === hoveredId;
          return (
            <span
              key={m.id}
              style={{
                position: "absolute",
                left: m.x - clip.x,
                top: m.y - clip.y,
                width: box,
                height: box,
                marginLeft: -box / 2,
                marginTop: -box / 2,
                color: m.lived ? INK_LIVED : INK_FUTURE,
                // Grows in step with the cell the renderer pops beneath it.
                transform: hot ? `scale(${HOVER_SCALE})` : "scale(1)",
                transformOrigin: "center",
                transition: reducedMotion
                  ? "none"
                  : `transform 130ms ${TOKENS.easeOut}`,
                zIndex: hot ? 1 : 0,
              }}
            >
              <svg
                width={box}
                height={box}
                viewBox="0 0 24 24"
                style={{ display: "block" }}
              >
                {SHAPES[m.symbol] ?? SHAPES[EVENT_SYMBOL.record]}
              </svg>
            </span>
          );
        })}
      </div>
    </div>
  );
}
