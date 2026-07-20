"use client";

import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { TOKENS, type HoverCardInfo } from "./types";

const CARD_W = 260;
const OFFSET = 14;
const EDGE = 8;
const FADE_MS = 120;
/** Used only until the card has been measured once. */
const ESTIMATED_H = 140;

const CSS_VARS = {
  "--lc-text": TOKENS.text,
  "--lc-text-dim": TOKENS.textDim,
  "--lc-text-faint": TOKENS.textFaint,
} as CSSProperties;

const LABEL_METRICS: CSSProperties = {
  fontSize: "10px",
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const VALUE_STYLE: CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  fontWeight: 400,
  letterSpacing: "0.02em",
  color: TOKENS.text,
  // User-supplied labels are interpolated unbounded; break rather than spill.
  overflowWrap: "anywhere",
};

const MS_PER_DAY = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local-calendar ISO date, e.g. "2036-10-30". */
export function formatEventDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calendar-aware distance from `now`, e.g. "IN 10Y 3M", "4M AGO", "IN 12D".
 * Whole months are counted on the calendar, so "exactly one year" is 1Y, not
 * 12M or 365D.
 */
export function formatRelative(date: Date, now: Date): string {
  const a = startOfDay(now);
  const b = startOfDay(date);
  const aTime = a.getTime();
  const bTime = b.getTime();
  if (aTime === bTime) return "TODAY";

  const future = bTime > aTime;
  const from = future ? a : b;
  const to = future ? b : a;

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;

  let span: string;
  if (months < 1) {
    span = `${Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)}D`;
  } else {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years}Y`);
    if (rest > 0) parts.push(`${rest}M`);
    span = parts.join(" ");
  }
  return future ? `IN ${span}` : `${span} AGO`;
}

export interface HoverCardProps {
  info: HoverCardInfo | null;
  viewportW: number;
  viewportH: number;
  reducedMotion: boolean;
}

/**
 * The hover readout — one card for both life events and places. Position lives
 * inside `info`, so during the exit fade the retained `shown` still carries its
 * anchor; the card never snaps to the top-left as it fades out.
 */
export function HoverCard({
  info,
  viewportW,
  viewportH,
  reducedMotion,
}: HoverCardProps) {
  // The card outlives `info` by one fade so the exit is not a content pop.
  // Content is adjusted during render (React's documented derived-state
  // pattern); only the delayed clear runs from a timer.
  const [shown, setShown] = useState<HoverCardInfo | null>(info);
  const [height, setHeight] = useState(ESTIMATED_H);
  const cardRef = useRef<HTMLDivElement | null>(null);
  if (info !== null && info !== shown) setShown(info);
  const visible = info !== null;

  useEffect(() => {
    if (info !== null || shown === null) return;
    const timer = window.setTimeout(
      () => setShown(null),
      reducedMotion ? 0 : FADE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [info, shown, reducedMotion]);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (node) setHeight(node.offsetHeight);
  }, [shown]);

  if (!shown) return null;

  // Anchor comes from the retained card, not a live prop — this is what keeps
  // the fading card in place instead of jumping to (0, 0).
  const { x, y } = shown;
  const flipX = x + OFFSET + CARD_W > viewportW - EDGE;
  const rawLeft = flipX ? x - OFFSET - CARD_W : x + OFFSET;
  const left = Math.max(EDGE, Math.min(rawLeft, viewportW - EDGE - CARD_W));

  const flipY = y + OFFSET + height > viewportH - EDGE;
  const rawTop = flipY ? y - OFFSET - height : y + OFFSET;
  const top = Math.max(EDGE, Math.min(rawTop, viewportH - EDGE - height));

  return (
    <div
      ref={cardRef}
      aria-hidden
      className="pointer-events-none absolute z-30"
      style={{
        ...CSS_VARS,
        left,
        top,
        width: CARD_W,
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
        backgroundColor: "#0A0B0B",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: 0,
        padding: 14,
        fontFamily: "var(--font-geist-mono)",
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? "none" : `opacity ${FADE_MS}ms linear`,
      }}
    >
      <div className="flex items-center gap-2" style={LABEL_METRICS}>
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            flex: "none",
            // Filled swatch for solid markers; an outline for hollow ones
            // (crossroads, places), matching how they render on the grid.
            backgroundColor: shown.hollow ? "transparent" : shown.swatch,
            boxShadow: shown.hollow
              ? `inset 0 0 0 1px ${shown.swatch}`
              : undefined,
          }}
        />
        <span style={{ color: TOKENS.textDim }}>{shown.kind}</span>
      </div>

      <div style={{ ...LABEL_METRICS, marginTop: 8, color: TOKENS.textDim }}>
        {shown.dateLine}
      </div>

      <div style={{ ...VALUE_STYLE, marginTop: 2 }}>{shown.title}</div>

      <p
        style={{
          fontSize: "12px",
          lineHeight: "18px",
          fontWeight: 400,
          letterSpacing: "0.01em",
          marginTop: 8,
          color: TOKENS.textDim,
          overflowWrap: "anywhere",
        }}
      >
        {shown.detail}
      </p>

      {shown.basis ? (
        <p
          style={{
            ...LABEL_METRICS,
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${TOKENS.hairline}`,
            color: TOKENS.textFaint,
            overflowWrap: "anywhere",
          }}
        >
          {shown.basis}
        </p>
      ) : null}
    </div>
  );
}

export { HoverCard as LifeClockHoverCard };
