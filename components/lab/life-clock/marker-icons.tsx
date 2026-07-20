"use client";

import { TOKENS } from "./types";

// Grows in step with the cell the renderer pops beneath it.
const HOVER_SCALE = 1.7;
// Monochrome, theme only. A marker on an elapsed (bright) cell is dark; on an
// unlived (dark) cell it is light — so the glyph reads either way, no backdrop.
const INK_LIVED = TOKENS.bg;
const INK_FUTURE = TOKENS.text;

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
  /** The (square) cell size in px — the box each symbol sits inside. */
  size: number;
  /** Shown only once settled in LIFE; fades with the grid on a morph. */
  visible: boolean;
  hoveredId: string | null;
  reducedMotion: boolean;
}

/**
 * The life-event markers, as minimal ASCII-ish symbols pinned to their week
 * cells on the LIFE grid — a DOM overlay with pointer-events off, so the canvas
 * underneath still hit-tests hovers. The symbol grades the nature of the claim
 * (see EVENT_SYMBOL); the card carries the specifics.
 */
export function MarkerIcons({
  icons,
  size,
  visible,
  hoveredId,
  reducedMotion,
}: MarkerIconsProps) {
  // Glyphs sit smaller than their em box, so the font size runs a touch over
  // the cell to fill it without spilling.
  const font = Math.max(6, Math.round(size * 1.05));

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
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-geist-mono), system-ui, sans-serif",
              fontSize: font,
              lineHeight: 1,
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
            {m.symbol}
          </span>
        );
      })}
    </div>
  );
}
