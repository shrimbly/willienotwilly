"use client";

import {
  Activity,
  Baby,
  Cake,
  DoorOpen,
  Gem,
  Heart,
  HeartCrack,
  HeartHandshake,
  Hourglass,
  Milestone,
  Signpost,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { TOKENS } from "./types";

/** Lucide component per event icon key (see lib/life-events.ts). */
const ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  "heart-handshake": HeartHandshake,
  gem: Gem,
  baby: Baby,
  "users-round": UsersRound,
  cake: Cake,
  "door-open": DoorOpen,
  "heart-crack": HeartCrack,
  "user-round": UserRound,
  signpost: Signpost,
  milestone: Milestone,
  activity: Activity,
  hourglass: Hourglass,
};

/** Below this cell size there isn't room for a legible icon — show a dot. */
const MIN_CELL_PX = 11.5;
/** Icon glyph as a fraction of the cell — a little padding inside the square. */
const ICON_FILL = 0.72;
// Grows with the cell beneath it (the renderer pops that cell in tandem).
const HOVER_SCALE = 1.7;
// Monochrome, theme only. A marker on an elapsed (bright) cell is dark; on an
// unlived (dark) cell it is light — so it reads either way without a backdrop.
const INK_LIVED = TOKENS.bg;
const INK_FUTURE = TOKENS.text;

export interface MarkerIcon {
  id: string;
  icon: string;
  /** true when the event's cell is already lived (a bright cell). */
  lived: boolean;
  /** Cell centre in layout px, relative to the clock container. */
  x: number;
  y: number;
}

export interface MarkerIconsProps {
  icons: MarkerIcon[];
  /** The (square) cell size in px — the box each marker must fit inside. */
  size: number;
  /** Shown only once settled in LIFE; fades with the grid on a morph. */
  visible: boolean;
  hoveredId: string | null;
  reducedMotion: boolean;
}

/**
 * The life-event markers, as Lucide icons pinned to their week cells on the
 * LIFE grid. Each glyph fits inside its cell; where the cell is too small to
 * read one, a dot stands in. Monochrome (theme dark/light, chosen so the mark
 * contrasts with its cell) — a DOM overlay with pointer-events off, so the
 * canvas underneath still hit-tests hovers.
 */
export function MarkerIcons({
  icons,
  size,
  visible,
  hoveredId,
  reducedMotion,
}: MarkerIconsProps) {
  // Icon (smaller than the cell) where there's room; a dot below that.
  const showIcon = size >= MIN_CELL_PX;
  const glyph = Math.max(8, Math.round(size * ICON_FILL));
  const dot = Math.max(3, Math.round(size * 0.4));
  const box = showIcon ? glyph : dot;

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
        const Icon = ICONS[m.icon] ?? Milestone;
        const hot = m.id === hoveredId;
        const ink = m.lived ? INK_LIVED : INK_FUTURE;
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
              display: "grid",
              placeItems: "center",
              color: ink,
              // Grows in step with the cell the renderer pops beneath it.
              transform: hot ? `scale(${HOVER_SCALE})` : "scale(1)",
              transformOrigin: "center",
              transition: reducedMotion
                ? "none"
                : `transform 130ms ${TOKENS.easeOut}`,
              zIndex: hot ? 1 : 0,
            }}
          >
            {showIcon ? (
              <Icon size={glyph} strokeWidth={2.25} />
            ) : (
              <span
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: "9999px",
                  backgroundColor: ink,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
