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

import { TOKENS, TONE_COLOR, type EventTone } from "./types";

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

const HOVER_SCALE = 1.7;

export interface MarkerIcon {
  id: string;
  icon: string;
  tone: EventTone;
  /** Cell centre in layout px, relative to the clock container. */
  x: number;
  y: number;
}

export interface MarkerIconsProps {
  icons: MarkerIcon[];
  /** Icon box size in px (roughly one grid cell). */
  size: number;
  /** Shown only once settled in LIFE; fades with the grid on a morph. */
  visible: boolean;
  hoveredId: string | null;
  reducedMotion: boolean;
}

/**
 * The life-event markers, as Lucide icons pinned to their week cells on the
 * LIFE grid. A DOM overlay (crisp SVG at any DPR) rather than canvas dots;
 * pointer-events stay off so the canvas underneath still hit-tests hovers.
 * Each icon carries a dark backdrop disc so it reads on the bright lived cells
 * as well as the dark future ones — a flat plate, not a glow.
 */
export function MarkerIcons({
  icons,
  size,
  visible,
  hoveredId,
  reducedMotion,
}: MarkerIconsProps) {
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
        const pad = Math.max(2, Math.round(size * 0.16));
        const disc = size + pad;
        return (
          <span
            key={m.id}
            style={{
              position: "absolute",
              left: m.x,
              top: m.y,
              width: disc,
              height: disc,
              marginLeft: -disc / 2,
              marginTop: -disc / 2,
              display: "grid",
              placeItems: "center",
              borderRadius: "9999px",
              backgroundColor: TOKENS.bg,
              color: TONE_COLOR[m.tone],
              transform: hot ? `scale(${HOVER_SCALE})` : "scale(1)",
              transformOrigin: "center",
              transition: reducedMotion
                ? "none"
                : `transform 130ms ${TOKENS.easeOut}`,
              zIndex: hot ? 1 : 0,
            }}
          >
            <Icon size={size} strokeWidth={2.25} />
          </span>
        );
      })}
    </div>
  );
}
