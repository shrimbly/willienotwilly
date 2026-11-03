"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cancelFrame, frame, isMotionValue, type FrameData, type MotionValue } from "motion/react";

import {
  RIPPLE,
  WORKING_TEXT,
  fillRadius,
  frontFadeMask,
  leadRing,
  ringArc,
  rippleRings,
  verticalRadius,
  type FrontFade,
} from "@/lib/booth/ripple-bar";
import { cn } from "@/lib/utils";

import { BOOTH_FOCUS_RING } from "./done-screen";
import { BoothIcon } from "./icons";

// The Working screen, ported from studiovoice/app/Sources/Booth/UI/Screens/WorkingScreen.swift
// (`RippleCanvas`, `RippleBarText`, `WorkingRow`) with the maths of BoothCore/RippleBar.swift
// (lib/booth/ripple-bar.ts). The whole popover is the progress bar: the fill spreads from the
// left like sound from a speaker, faint rings move out through it in bursts, one runs ahead of
// it, and the file name comes into focus only once the fill has passed under it.
//
// The app draws the fill and the rings in two blurred Canvas layers; here each is its own
// canvas under a CSS blur (2.5 and 0.6 px), which every browser supports, drawn a little past
// the bar so the blur never fades at its edges. Each frame is drawn at most once, in Motion's
// render step, whatever moved it: the rings' clock, or a progress that changes every frame.
// The fill's canvas and the text's masks are redrawn only when the front moves.

/** Room round each canvas for its blur, clipped by the bar. */
const BLEED = 8;

interface Colours {
  text: string;
  ink0: string;
  ink3: string;
}

function readColours(el: Element): Colours {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return { text: read("--booth-text", "#1d1d1f"), ink0: read("--booth-ink0", "#1d1d1f"), ink3: read("--booth-ink3", "#8e8e93") };
}

/** A canvas `width` × 56 pt plus its bleed, at `ratio` device pixels per point, cleared. */
function prepare(canvas: HTMLCanvasElement, width: number, ratio: number) {
  const w = Math.round((width + 2 * BLEED) * ratio);
  const h = Math.round((RIPPLE.height + 2 * BLEED) * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, BLEED * ratio, BLEED * ratio);
  ctx.clearRect(-BLEED, -BLEED, width + 2 * BLEED, RIPPLE.height + 2 * BLEED);
  return ctx;
}

function ellipse(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(RIPPLE.sourceX, RIPPLE.midY, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
}

/** The faint ring running ahead of the fill, unblurred, in the text colour. */
function paintLead(canvas: HTMLCanvasElement, width: number, ratio: number, front: number, ms: number, colours: Colours) {
  const ctx = prepare(canvas, width, ratio);
  if (!ctx) return;
  const ring = leadRing(ms, front);
  ellipse(ctx, ring.rx, ring.ry);
  ctx.globalAlpha = ring.alpha;
  ctx.strokeStyle = colours.text;
  ctx.lineWidth = ring.lineWidth;
  ctx.stroke();
}

/** The fill: an ellipse about the source, reaching the front at mid-height, in `ink0`. */
function paintFill(canvas: HTMLCanvasElement, width: number, ratio: number, front: number, colours: Colours) {
  const ctx = prepare(canvas, width, ratio);
  if (!ctx) return;
  const rx = fillRadius(front);
  ellipse(ctx, rx, verticalRadius(rx));
  ctx.fillStyle = colours.ink0;
  ctx.fill();
}

/** The rings inside the fill: each a faint wide band round a hairline, in `ink3`, wavering. */
function paintRings(canvas: HTMLCanvasElement, width: number, ratio: number, front: number, ms: number, colours: Colours) {
  const ctx = prepare(canvas, width, ratio);
  if (!ctx) return;
  ctx.strokeStyle = colours.ink3;
  for (const ring of rippleRings(ms, front)) {
    const points = ringArc(ring, RIPPLE.height, ms);
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.globalAlpha = ring.bandAlpha;
    ctx.lineWidth = ring.bandWidth;
    ctx.stroke();
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.lineWidth;
    ctx.stroke();
  }
}

type RowLayer = { fade: FrontFade; onFill: boolean; marks: boolean; nameBlur?: number; nameOpacity?: number };

/** The bar's text drawn once per colour and focus, each drawing masked to where it belongs. */
const ROW_LAYERS: RowLayer[] = [
  { fade: WORKING_TEXT.marks, onFill: false, marks: true },
  ...WORKING_TEXT.nameLayers.map((layer) => ({
    fade: layer.fade,
    onFill: layer.onFill,
    marks: false,
    nameBlur: layer.blur,
    nameOpacity: layer.opacity,
  })),
  { fade: WORKING_TEXT.marksOnFill, onFill: true, marks: true },
];

const canvasStyle = (blur: number): CSSProperties => ({
  position: "absolute",
  left: -BLEED,
  top: -BLEED,
  width: `calc(100% + ${2 * BLEED}px)`,
  height: RIPPLE.height + 2 * BLEED,
  filter: blur ? `blur(${blur}px)` : undefined,
});

export interface BoothWorkingBarProps {
  /**
   * 0…1: a number, or a motion value for progress that moves every frame (no re-render). Set it
   * from Motion's `frame.update` and the bar draws that value in the same frame.
   */
  progress: number | MotionValue<number>;
  /** The file in the booth, e.g. "interview-take3.m4a". */
  name: string;
  /** Lets the rings move (pass `active`). Stopped, they hold where they are. */
  running?: boolean;
  /** Holds the rings at the app's still moment (12 s on their clock), as under Reduce Motion. */
  reducedMotion?: boolean;
  /**
   * How far the demo scales the bar on screen (its stage's own scale), so the canvases are drawn
   * at the screen's pixels. Pass it wherever the stage is scaled: measured from the bar itself,
   * the scale is caught part way through the popover's spring or a screen swap, and a later
   * change of the stage's transform is never seen. Measured when left out.
   */
  scale?: number;
  /** The × at the right end. Without it the × still draws but nothing takes the click. */
  onCancel?: () => void;
  /** Hidden from assistive tech, for a demo whose own control carries the value. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The Working screen: the ripple bar, 56 pt tall, filling its parent's width (311 pt inside
 * the popover, which sits 4 pt from the glass while it shows). Percent on the left and the name
 * on the right are its only text; the name is blurred until the front reaches it, turns pale as
 * it crosses, and comes into focus in steps inside the fill. A progressbar for assistive tech,
 * unless `decorative`.
 */
export function BoothWorkingBar({
  progress,
  name,
  running = true,
  reducedMotion = false,
  scale,
  onCancel,
  decorative = false,
  className,
  style,
}: BoothWorkingBarProps) {
  const root = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLCanvasElement>(null);
  const fill = useRef<HTMLCanvasElement>(null);
  const rings = useRef<HTMLCanvasElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const percents = useRef<(HTMLSpanElement | null)[]>([]);
  // The rings' clock starts where the app's snapshots hold it, so a still bar looks the same.
  const clock = useRef<number>(RIPPLE.stillMilliseconds);
  /** What was last drawn; `stale` after a new size, pixel ratio or palette, when all of it is drawn again. */
  const state = useRef({ width: 0, ratio: 1, front: -1, ms: -1, percent: -1, stale: true, colours: null as Colours | null });

  // Written straight to the canvases and the text layers' styles, never through React.
  const api = useRef<{ paint: () => void; measure: (now: boolean) => void }>({ paint: () => {}, measure: () => {} });
  /** One drawing in Motion's render step, however many changes asked for it. */
  const [draw] = useState(() => () => api.current.paint());
  useLayoutEffect(() => {
    /** Draws what moved since the last drawing: nothing, if neither the front nor the rings did. */
    const paint = () => {
      const el = root.current;
      const s = state.current;
      if (!el || !lead.current || !fill.current || !rings.current || s.width <= 0) return;
      const value = Math.min(1, Math.max(0, isMotionValue(progress) ? progress.get() : progress));
      const front = s.width * value;
      const ms = reducedMotion ? RIPPLE.stillMilliseconds : clock.current;
      const frontMoved = s.stale || front !== s.front;
      if (!frontMoved && ms === s.ms) return;
      s.stale = false;
      s.colours ??= readColours(el);
      // The rings fade by how far they are through the fill, so they follow the front too.
      paintLead(lead.current, s.width, s.ratio, front, ms, s.colours);
      paintRings(rings.current, s.width, s.ratio, front, ms, s.colours);
      s.ms = ms;
      if (!frontMoved) return;
      paintFill(fill.current, s.width, s.ratio, front, s.colours);
      s.front = front;
      ROW_LAYERS.forEach((layer, i) => {
        const node = layers.current[i];
        if (!node) return;
        const mask = frontFadeMask(layer.fade, front, s.width);
        node.style.maskImage = mask;
        node.style.webkitMaskImage = mask;
      });
      const pct = Math.round(value * 100);
      if (pct === s.percent) return;
      s.percent = pct;
      percents.current.forEach((span) => {
        if (span) span.textContent = `${pct}%`;
      });
      if (!decorative) el.setAttribute("aria-valuenow", String(pct));
    };
    /**
     * Reads the size, the pixel ratio and the palette, then draws everything: `now`, or in the
     * next render step with whatever else moves then (a resize mid-frame keeps one drawing a frame).
     */
    const measure = (now: boolean) => {
      const el = root.current;
      if (!el) return;
      const s = state.current;
      const k = scale ?? (el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1);
      s.width = el.offsetWidth;
      // At the screen's pixels however far the bar is scaled, never under one per point.
      s.ratio = Math.max(1, (window.devicePixelRatio || 1) * k);
      s.colours = readColours(el);
      s.stale = true;
      if (now) paint();
      else frame.render(draw);
    };
    api.current = { paint, measure };
  });

  // Its own size and the screen's pixel density (a window moved to another display).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(() => api.current.measure(false));
    observer.observe(el);
    let density: MediaQueryList | null = null;
    const onDensity = () => {
      watchDensity();
      api.current.measure(false);
    };
    const watchDensity = () => {
      density?.removeEventListener("change", onDensity);
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      density.addEventListener("change", onDensity);
    };
    watchDensity();
    return () => {
      observer.disconnect();
      density?.removeEventListener("change", onDensity);
      cancelFrame(draw);
    };
  }, [draw]);

  // At mount, before the first paint (the text layers are unmasked until then), and whenever
  // the demo's scale changes.
  useLayoutEffect(() => api.current.measure(true), [scale]);

  // The rings move on their own clock while running, drawn in Motion's render step.
  useEffect(() => {
    if (!running || reducedMotion) {
      api.current.paint();
      return;
    }
    const tick = ({ delta }: FrameData) => {
      clock.current += Math.min(100, delta);
      api.current.paint();
    };
    frame.render(tick, true);
    return () => cancelFrame(tick);
  }, [running, reducedMotion]);

  // Progress repaints whenever it changes, in the same render step: a frame both move is drawn once.
  useEffect(() => {
    if (!isMotionValue(progress)) {
      api.current.paint();
      return;
    }
    return progress.on("change", () => frame.render(draw));
  }, [progress, draw]);

  return (
    <div
      ref={root}
      role={decorative ? undefined : "progressbar"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : name}
      aria-valuemin={decorative ? undefined : 0}
      aria-valuemax={decorative ? undefined : 100}
      className={cn("relative h-14 w-full overflow-hidden bg-(color:--booth-ink-track)", className)}
      style={style}
    >
      <canvas ref={lead} aria-hidden style={canvasStyle(0)} />
      <canvas ref={fill} aria-hidden style={canvasStyle(RIPPLE.fillSoftness)} />
      <canvas ref={rings} aria-hidden style={canvasStyle(RIPPLE.ringSoftness)} />
      {ROW_LAYERS.map((layer, i) => (
        <div
          key={i}
          ref={(node) => {
            layers.current[i] = node;
          }}
          aria-hidden
          className="absolute inset-0 flex items-center gap-3 pr-2 pl-4"
          style={{ color: layer.onFill ? "var(--booth-on-ink)" : "var(--booth-text)" }}
        >
          <span
            ref={(node) => {
              percents.current[i] = node;
            }}
            className="min-w-8 text-[13px] leading-4 font-semibold tabular-nums"
            style={{ opacity: layer.marks ? 1 : 0 }}
          >
            0%
          </span>
          <span
            className="min-w-0 flex-1 truncate text-right text-[15px] leading-5 font-medium"
            style={{
              opacity: layer.nameOpacity ?? 0,
              filter: layer.nameBlur ? `blur(${layer.nameBlur}px)` : undefined,
            }}
          >
            {name}
          </span>
          <span className="grid size-6 place-items-center" style={{ opacity: layer.marks ? 0.7 : 0 }}>
            <BoothIcon name="close" size={14} />
          </span>
        </div>
      ))}
      {onCancel && (
        <button
          type="button"
          aria-label="Cancel"
          onClick={onCancel}
          className={cn("absolute top-1/2 right-2 size-6 -translate-y-1/2 rounded-[7px]", BOOTH_FOCUS_RING)}
        />
      )}
    </div>
  );
}
