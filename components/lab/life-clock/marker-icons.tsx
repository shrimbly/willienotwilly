"use client";

import type { ReactNode } from "react";

import { EVENT_SYMBOL, TOKENS } from "./types";

// Grows in step with the cell the renderer pops beneath it.
const HOVER_SCALE = 1.7;
// Fraction of the (square) cell the symbol box occupies — a bit smaller so it
// sits comfortably inside its cell.
const SIZE_FRAC = 0.6;
// Monochrome, theme only. A marker on an elapsed (bright) cell is dark; on an
// unlived (dark) cell it is light — so the glyph reads either way, no backdrop.
const INK_LIVED = TOKENS.bg;
const INK_FUTURE = TOKENS.text;

const R = 9; // circle radius in the 24-unit viewBox
const SW = 3; // stroke width for hollow shapes
const D = 9.5; // diamond half-diagonal

// The four symbols as centred SVG shapes (currentColor = the adaptive ink):
// ● record, ○ estimate, ◐ probability (left half filled), ◆ crossroad.
const SHAPES: Record<string, ReactNode> = {
  [EVENT_SYMBOL.record]: <circle cx="12" cy="12" r={R} fill="currentColor" />,
  [EVENT_SYMBOL.estimate]: (
    <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth={SW} />
  ),
  [EVENT_SYMBOL.probability]: (
    <>
      <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth={SW} />
      <path d={`M12 ${12 - R} A${R} ${R} 0 0 0 12 ${12 + R} Z`} fill="currentColor" />
    </>
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
  /** The glyph to draw — ● record, ○ estimate, ◐ probability, ◆ crossroad. */
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
}: MarkerIconsProps) {
  const box = Math.max(5, Math.round(size * SIZE_FRAC));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        opacity: visible ? 1 : 0,
        transition: reducedMotion
          ? "none"
          : `opacity ${visible ? 180 : 90}ms linear`,
      }}
    >
      {icons.map((m) => {
        const hot = m.id === hoveredId;
        return (
          <span
            key={m.id}
            style={{
              position: "absolute",
              left: m.x,
              top: m.y,
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
  );
}
