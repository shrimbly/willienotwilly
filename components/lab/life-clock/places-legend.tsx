"use client";

import type { CSSProperties } from "react";

import { placeYears, type PlaceBand } from "@/lib/life-places";

import { TOKENS } from "./types";

const LABEL_METRICS: CSSProperties = {
  fontSize: "10px",
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export interface PlacesLegendProps {
  bands: PlaceBand[];
  /** Shown only once settled in the LIFE view with PLACES on. */
  visible: boolean;
  reducedMotion: boolean;
}

/**
 * The PLACES legend — a map key for the location bands tinting the LIFE grid.
 * A centered horizontal strip of swatch · place · years, sitting above the
 * bottom chrome. Purely informational (pointer-events: none); it fades with
 * the overlay it explains.
 */
export function PlacesLegend({ bands, visible, reducedMotion }: PlacesLegendProps) {
  if (bands.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[112px] left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:bottom-[76px]"
      style={{
        ...LABEL_METRICS,
        maxWidth: "min(92vw, 680px)",
        fontFamily: "var(--font-geist-mono)",
        opacity: visible ? 1 : 0,
        transition: reducedMotion
          ? "none"
          : `opacity ${visible ? 220 : 160}ms linear`,
      }}
    >
      <span style={{ color: TOKENS.textFaint }}>WHERE</span>
      {bands.map((band, i) => (
        <span key={`${band.label}-${i}`} className="flex items-center gap-[6px]">
          <span
            style={{
              width: 9,
              height: 9,
              flex: "none",
              backgroundColor: band.hex,
            }}
          />
          <span style={{ color: TOKENS.textDim }}>{band.label}</span>
          <span style={{ color: TOKENS.textFaint }}>{placeYears(band)}</span>
        </span>
      ))}
    </div>
  );
}
