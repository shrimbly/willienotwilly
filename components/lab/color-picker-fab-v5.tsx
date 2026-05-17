"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type PickerControl = {
  open: boolean;
  forcePointerAt?: { angleDeg: number; distance: number };
};

type Props = {
  swatches?: string[];
  onPick?: (color: string) => void;
  config?: Partial<Config>;
  control?: PickerControl | null;
};

export type Config = {
  holdMs: number;
  fabSize: number;
  fabInset: number; // distance from screen edge (bottom & right)
  swatchSize: number;
  arcRadius: number;
  ribbonInner: number;
  ribbonOuter: number;
  indicatorSize: number;
  arcSpanDeg: number; // visible OUTER ribbon arc width
  swatchSpanDeg: number; // angular fan width of the swatch ring (independent of ribbon)
  arcRotationDeg: number; // rotate the whole picker around the FAB; 0 = anchored at up-left
  expandPad: number;
  ribbonL: number; // OKLCH lightness 0..1
  ribbonC: number; // OKLCH chroma
  openDurationMs: number;
  ribbonScaleFromPct: number; // 60..100
};

export const DEFAULT_CONFIG: Config = {
  holdMs: 180,
  fabSize: 56,
  fabInset: 41,
  swatchSize: 26,
  arcRadius: 109,
  ribbonInner: 133,
  ribbonOuter: 162,
  indicatorSize: 28,
  arcSpanDeg: 106,
  swatchSpanDeg: 90,
  arcRotationDeg: 0,
  expandPad: 10,
  ribbonL: 0.7,
  ribbonC: 0.18,
  openDurationMs: 360,
  ribbonScaleFromPct: 88,
};

const DEFAULT_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

const SOFT_EASE = [0.22, 1, 0.36, 1] as const;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function hexToHue(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hueAtT(t: number, anchors: number[]): number {
  const n = anchors.length - 1;
  const clamped = Math.max(0, Math.min(1, t));
  const seg = Math.min(n - 1, Math.floor(clamped * n));
  const segT = clamped * n - seg;
  const h0 = anchors[seg];
  const h1 = anchors[seg + 1];
  let delta = h1 - h0;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  return (h0 + delta * segT + 360) % 360;
}

export function ColorPickerFabV5({
  swatches = DEFAULT_SWATCHES,
  onPick,
  config: configOverride,
  control,
}: Props) {
  const config = { ...DEFAULT_CONFIG, ...configOverride };
  const {
    holdMs,
    fabSize,
    fabInset,
    swatchSize,
    arcRadius,
    ribbonInner,
    ribbonOuter,
    indicatorSize,
    arcSpanDeg,
    swatchSpanDeg,
    arcRotationDeg,
    expandPad,
    ribbonL,
    ribbonC,
    openDurationMs,
    ribbonScaleFromPct,
  } = config;

  // Picker centre angle (math); rotation shifts the whole thing.
  const arcCenterDeg = 225 + arcRotationDeg;

  // Swatch fan: independent of ribbon span.
  const swatchSpan = swatchSpanDeg;
  const swatchStartDeg = arcCenterDeg - swatchSpan / 2;
  const swatchStartPos = ((swatchStartDeg % 360) + 360) % 360;

  // Ribbon: arcSpanDeg is the visible OUTER arc width (what the user sees).
  // Tangent points on the FAB sit α_out outside the visible outer arc on
  // each side; the inner arc reaches slightly past the outer arc by α_diff.
  const fabR = fabSize / 2;
  const effectiveInner = Math.max(fabR, ribbonInner);
  const alphaOutDeg = (Math.acos(Math.min(1, fabR / ribbonOuter)) * 180) / Math.PI;
  const alphaInDeg = (Math.acos(Math.min(1, fabR / effectiveInner)) * 180) / Math.PI;
  const ribbonStartDeg = arcCenterDeg - arcSpanDeg / 2; // outer arc left edge (math)
  const ribbonEndDeg = arcCenterDeg + arcSpanDeg / 2; // outer arc right edge (math)
  const ribbonStartPos = ((ribbonStartDeg % 360) + 360) % 360;
  const tangentLeftDeg = ribbonStartDeg - alphaOutDeg; // tangent point on FAB (math)
  const tangentRightDeg = ribbonEndDeg + alphaOutDeg;

  const expandThreshold = arcRadius + expandPad;
  const ribbonMid = (ribbonInner + ribbonOuter) / 2;

  // Conic "from" angle: place conic angle 0 at math ribbonStartDeg, then we'll
  // pad the gradient with α_diff buffers on each side so the inner-arc overhang
  // is fully coloured. CSS conic angle = math + 90.
  const alphaDiffDeg = Math.max(0, alphaOutDeg - alphaInDeg);
  const conicFromDeg =
    ((((ribbonStartDeg - alphaDiffDeg) + 90) % 360) + 360) % 360;

  // Ribbon clip-path geometry (local coords of the ribbon div).
  const dIn = Math.sqrt(Math.max(0, effectiveInner * effectiveInner - fabR * fabR));
  const dOut = Math.sqrt(Math.max(0, ribbonOuter * ribbonOuter - fabR * fabR));
  const tLeftRad = (tangentLeftDeg * Math.PI) / 180;
  const tRightRad = (tangentRightDeg * Math.PI) / 180;
  const localC = ribbonOuter;
  const tLeftPt = {
    x: localC + fabR * Math.cos(tLeftRad),
    y: localC + fabR * Math.sin(tLeftRad),
  };
  const tRightPt = {
    x: localC + fabR * Math.cos(tRightRad),
    y: localC + fabR * Math.sin(tRightRad),
  };
  // Tangent directions pointing INTO the arc body
  const leftTan = { x: -Math.sin(tLeftRad), y: Math.cos(tLeftRad) };
  const rightTan = { x: Math.sin(tRightRad), y: -Math.cos(tRightRad) };
  const leftInnerPt = { x: tLeftPt.x + dIn * leftTan.x, y: tLeftPt.y + dIn * leftTan.y };
  const leftOuterPt = { x: tLeftPt.x + dOut * leftTan.x, y: tLeftPt.y + dOut * leftTan.y };
  const rightInnerPt = { x: tRightPt.x + dIn * rightTan.x, y: tRightPt.y + dIn * rightTan.y };
  const rightOuterPt = { x: tRightPt.x + dOut * rightTan.x, y: tRightPt.y + dOut * rightTan.y };
  // By construction, outer arc spans exactly arcSpanDeg from ribbonStart to
  // ribbonEnd (sweep=1, increasing math angle in y-down space). The inner arc
  // spans arcSpanDeg + 2*α_diff, so it goes from rightInner back to leftInner
  // in decreasing math angle (sweep=0).
  // Each of the four corners gets a small quadratic-bezier fillet so the
  // arc/ribbon reads as softly rounded rather than sharp.
  const cornerR = 6;
  const outerStepDeg = ((cornerR / ribbonOuter) * 180) / Math.PI;
  const innerStepDeg = ((cornerR / effectiveInner) * 180) / Math.PI;
  const polarLocal = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: localC + r * Math.cos(rad), y: localC + r * Math.sin(rad) };
  };
  // Cap-side anchor points (R back from each corner along the tangent cap).
  const leftInnerCapIn = {
    x: leftInnerPt.x + cornerR * leftTan.x,
    y: leftInnerPt.y + cornerR * leftTan.y,
  };
  const leftOuterCapIn = {
    x: leftOuterPt.x - cornerR * leftTan.x,
    y: leftOuterPt.y - cornerR * leftTan.y,
  };
  const rightOuterCapIn = {
    x: rightOuterPt.x - cornerR * rightTan.x,
    y: rightOuterPt.y - cornerR * rightTan.y,
  };
  const rightInnerCapIn = {
    x: rightInnerPt.x + cornerR * rightTan.x,
    y: rightInnerPt.y + cornerR * rightTan.y,
  };
  // Arc-side anchor points (R-arc-length away from each corner along its arc).
  const leftOuterArcIn = polarLocal(ribbonOuter, ribbonStartDeg + outerStepDeg);
  const rightOuterArcIn = polarLocal(ribbonOuter, ribbonEndDeg - outerStepDeg);
  const leftInnerArcIn = polarLocal(
    effectiveInner,
    ribbonStartDeg - alphaDiffDeg + innerStepDeg,
  );
  const rightInnerArcIn = polarLocal(
    effectiveInner,
    ribbonEndDeg + alphaDiffDeg - innerStepDeg,
  );
  const outerLarge = arcSpanDeg - 2 * outerStepDeg > 180 ? 1 : 0;
  const innerLarge =
    arcSpanDeg + 2 * alphaDiffDeg - 2 * innerStepDeg > 180 ? 1 : 0;
  const fp = (p: { x: number; y: number }) =>
    `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const ribbonPath =
    `M ${fp(leftOuterCapIn)}` +
    ` Q ${fp(leftOuterPt)} ${fp(leftOuterArcIn)}` +
    ` A ${ribbonOuter} ${ribbonOuter} 0 ${outerLarge} 1 ${fp(rightOuterArcIn)}` +
    ` Q ${fp(rightOuterPt)} ${fp(rightOuterCapIn)}` +
    ` L ${fp(rightInnerCapIn)}` +
    ` Q ${fp(rightInnerPt)} ${fp(rightInnerArcIn)}` +
    ` A ${effectiveInner} ${effectiveInner} 0 ${innerLarge} 0 ${fp(leftInnerArcIn)}` +
    ` Q ${fp(leftInnerPt)} ${fp(leftInnerCapIn)}` +
    ` Z`;

  // Open outline path for the swatch-hover preview: left cap + inner arc +
  // right cap, with the outer arc omitted so the ribbon's outer edge is open.
  const ribbonOutlinePath =
    `M ${leftOuterPt.x.toFixed(2)} ${leftOuterPt.y.toFixed(2)}` +
    ` L ${leftInnerPt.x.toFixed(2)} ${leftInnerPt.y.toFixed(2)}` +
    ` A ${effectiveInner} ${effectiveInner} 0 ${innerLarge} 1 ${rightInnerPt.x.toFixed(2)} ${rightInnerPt.y.toFixed(2)}` +
    ` L ${rightOuterPt.x.toFixed(2)} ${rightOuterPt.y.toFixed(2)}`;

  // Centre of the ribbon (local coords) — used for the plus icon in the preview.
  const arcCenterRad = (arcCenterDeg * Math.PI) / 180;
  const previewCenter = {
    x: localC + ribbonMid * Math.cos(arcCenterRad),
    y: localC + ribbonMid * Math.sin(arcCenterRad),
  };

  const fabRef = useRef<HTMLButtonElement>(null);
  const holdTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [fabCenter, setFabCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const captureCenter = () => {
    const el = fabRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFabCenter({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  useLayoutEffect(() => {
    captureCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabSize, fabInset]);

  useEffect(() => {
    const handler = () => captureCenter();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Arc vertex sits at the FAB's bottom-right corner. With arcSpan=90° and
  // arcRotation=0°, the arc covers math angles 180°→270° exactly, so the
  // arc's top apex aligns with the FAB's right tangent and its left apex
  // aligns with the FAB's bottom tangent.
  const cx = fabCenter.x + fabSize / 2;
  const cy = fabCenter.y + fabSize / 2;

  // Synthetic pointer when in controlled-preview mode.
  const synthPointer =
    control?.forcePointerAt && (cx || cy)
      ? polar(cx, cy, control.forcePointerAt.distance, control.forcePointerAt.angleDeg)
      : null;
  const effOpen = control ? control.open : open;
  const effPointer = synthPointer ?? pointer;

  const dx = effPointer ? effPointer.x - cx : 0;
  const dy = effPointer ? effPointer.y - cy : 0;
  const dist = Math.hypot(dx, dy);
  let pointerDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (pointerDeg < 0) pointerDeg += 360;

  // FAB-relative distance: used only for the "is the pointer clearly outside
  // the FAB" gate, since `dist` is measured from the corner-anchored arc origin.
  const fabDx = effPointer ? effPointer.x - fabCenter.x : 0;
  const fabDy = effPointer ? effPointer.y - fabCenter.y : 0;
  const fabDist = Math.hypot(fabDx, fabDy);

  // Swatch hit detection (relative to swatch fan, independent of ribbon span).
  const swatchRawOffset = (((pointerDeg - swatchStartPos) % 360) + 360) % 360;
  let swatchPos: number;
  if (swatchRawOffset <= swatchSpan) swatchPos = swatchRawOffset;
  else if (swatchRawOffset > (swatchSpan + 360) / 2) swatchPos = 0;
  else swatchPos = swatchSpan;
  const inSwatchArc =
    effOpen &&
    effPointer !== null &&
    fabDist > fabSize / 2 &&
    (swatchRawOffset <= swatchSpan + 25 || swatchRawOffset >= 360 - 25);

  let activeIdx = -1;
  if (inSwatchArc) {
    const step = swatchSpan / (swatches.length - 1);
    const idx = Math.round(swatchPos / step);
    activeIdx = Math.max(0, Math.min(swatches.length - 1, idx));
  }

  // Ribbon hue mapping (relative to ribbon arc, independent of swatch fan).
  const ribbonRawOffset = (((pointerDeg - ribbonStartPos) % 360) + 360) % 360;
  let ribbonPos: number;
  if (ribbonRawOffset <= arcSpanDeg) ribbonPos = ribbonRawOffset;
  else if (ribbonRawOffset > (arcSpanDeg + 360) / 2) ribbonPos = 0;
  else ribbonPos = arcSpanDeg;
  const inRibbonArc =
    effOpen &&
    effPointer !== null &&
    fabDist > fabSize / 2 &&
    (ribbonRawOffset <= arcSpanDeg + 25 || ribbonRawOffset >= 360 - 25);

  // Picker is "in range" when the pointer is over the swatch fan or out on the
  // ribbon arc (whichever is wider).
  const inArc = inSwatchArc || inRibbonArc;
  const expanded = inArc && dist > expandThreshold;

  const swatchHues = swatches.map(hexToHue);

  // Map a math angle to a "swatch t" (0..1 across the swatch fan), clamped so
  // angles outside the swatch fan resolve to the first/last swatch hue. This
  // is what makes a swatch align with the ribbon hue directly outside it,
  // regardless of how the ribbon span compares to the swatch span.
  const swatchTAtMath = (mathDeg: number): number => {
    const off = (((mathDeg - swatchStartDeg) % 360) + 360) % 360;
    if (off <= swatchSpan) return off / swatchSpan;
    return off > (swatchSpan + 360) / 2 ? 0 : 1;
  };

  let ribbonHue = swatchHues[0];
  if (expanded && inRibbonArc) {
    ribbonHue = hueAtT(swatchTAtMath(ribbonStartDeg + ribbonPos), swatchHues);
  } else if (expanded && activeIdx >= 0) {
    ribbonHue = swatchHues[activeIdx];
  }
  const ribbonColor = `oklch(${ribbonL} ${ribbonC} ${ribbonHue})`;

  // Conic hue stops: sample math angles across the (slightly padded) ribbon
  // range and use the swatch-anchored hue at each. Outside the swatch fan the
  // hue is clamped to the first/last swatch, so the ends always read as the
  // bookend swatch colours.
  const hueStops = (() => {
    const conicSpan = arcSpanDeg + 2 * alphaDiffDeg;
    const N = 49;
    const stops: string[] = [];
    for (let i = 0; i < N; i++) {
      const conicDeg = (i / (N - 1)) * conicSpan;
      const mathDeg = ribbonStartDeg - alphaDiffDeg + conicDeg;
      const hue = hueAtT(swatchTAtMath(mathDeg), swatchHues);
      stops.push(`oklch(${ribbonL} ${ribbonC} ${hue}) ${conicDeg.toFixed(3)}deg`);
    }
    return stops.join(", ");
  })();

  // Live preview color shown on the FAB while dragging.
  const previewColor = expanded
    ? ribbonColor
    : activeIdx >= 0
      ? swatches[activeIdx]
      : null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (control) return;
    e.preventDefault();
    captureCenter();
    setPicked(null);
    setPressed(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    holdTimer.current = window.setTimeout(() => {
      setOpen(true);
      setPointer({ x: e.clientX, y: e.clientY });
    }, holdMs);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (control) return;
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
    if (control) return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (open) commitPick();
    setOpen(false);
    setPointer(null);
    setPressed(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const swatchStep = swatchSpan / (swatches.length - 1);

  const indicatorDeg = expanded
    ? inRibbonArc
      ? ribbonStartDeg + ribbonPos
      : swatchStartDeg + (activeIdx >= 0 ? activeIdx * swatchStep : 0)
    : 0;
  const indicatorPos = expanded ? polar(cx, cy, ribbonMid, indicatorDeg) : null;

  const fabBackground =
    previewColor ??
    picked ??
    "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)";

  const openSec = openDurationMs / 1000;

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
        {effOpen && (
          <>
            {/* Soft dark wash + blur, both expanding out from the FAB together.
                A radial-gradient mask fades the entire element (including its
                backdrop-filter) toward the edges, so the blur never has a
                defined boundary and only reaches text as the wash arrives. */}
            <motion.div
              key="backdrop"
              className="pointer-events-none fixed z-30 rounded-full"
              style={{
                width: "300vmax",
                height: "300vmax",
                left: cx,
                top: cy,
                marginLeft: "-150vmax",
                marginTop: "-150vmax",
                background:
                  "radial-gradient(circle, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                mask: "radial-gradient(circle, black 0%, black 35%, transparent 75%)",
                WebkitMask: "radial-gradient(circle, black 0%, black 35%, transparent 75%)",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2, ease: [0.42, 0, 1, 1] }}
            />

            <motion.div
              key="overlay"
              className="pointer-events-none fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: openSec * 0.6, ease: SOFT_EASE }}
            >
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    key="ribbon"
                    className="absolute"
                    style={{
                      width: 2 * ribbonOuter,
                      height: 2 * ribbonOuter,
                      left: cx - ribbonOuter,
                      top: cy - ribbonOuter,
                      background: `conic-gradient(from ${conicFromDeg}deg in oklch, ${hueStops})`,
                      clipPath: `path('${ribbonPath}')`,
                      WebkitClipPath: `path('${ribbonPath}')`,
                      filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.18))",
                    }}
                    initial={{
                      scale: ribbonScaleFromPct / 100,
                      opacity: 0,
                    }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ duration: openSec * 0.9, ease: SOFT_EASE }}
                  />
                )}
              </AnimatePresence>

              {/* Ribbon outline preview shown while hovering a swatch.
                  Subtle glass: light backdrop blur, faint white tint, thin
                  low-opacity outline. No glow, no gradients on the stroke. */}
              <AnimatePresence>
                {!expanded && activeIdx >= 0 && (
                  <motion.div
                    key="ribbon-outline"
                    className="absolute"
                    style={{
                      width: 2 * ribbonOuter,
                      height: 2 * ribbonOuter,
                      left: cx - ribbonOuter,
                      top: cy - ribbonOuter,
                    }}
                    initial={{ scale: ribbonScaleFromPct / 100, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ duration: openSec * 0.9, ease: SOFT_EASE }}
                  >
                    {/* Frosted fill (clipped to the closed ribbon shape) */}
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: `path('${ribbonPath}')`,
                        WebkitClipPath: `path('${ribbonPath}')`,
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        background: "rgba(255,255,255,0.14)",
                      }}
                    />
                    {/* Thin outline (3-sided, soft round joins) + plus */}
                    <svg
                      className="absolute inset-0"
                      style={{ overflow: "visible" }}
                      viewBox={`0 0 ${2 * ribbonOuter} ${2 * ribbonOuter}`}
                    >
                      <g
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth={2.75}
                        strokeLinecap="round"
                      >
                        <line
                          x1={previewCenter.x - 6}
                          y1={previewCenter.y}
                          x2={previewCenter.x + 6}
                          y2={previewCenter.y}
                        />
                        <line
                          x1={previewCenter.x}
                          y1={previewCenter.y - 6}
                          x2={previewCenter.x}
                          y2={previewCenter.y + 6}
                        />
                      </g>
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>

              {swatches.map((c, i) => {
                const deg = swatchStartDeg + i * swatchStep;
                const { x, y } = polar(cx, cy, arcRadius, deg);
                const isActive = !expanded && i === activeIdx;
                return (
                  <motion.div
                    key={c}
                    className="absolute rounded-full ring-1 ring-foreground/10 shadow-lg"
                    style={{
                      width: swatchSize,
                      height: swatchSize,
                      background: c,
                      left: x - swatchSize / 2,
                      top: y - swatchSize / 2,
                    }}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{
                      scale: isActive ? 1.2 : 1,
                      opacity: expanded ? 0.5 : 1,
                      transition: {
                        delay: i * 0.022,
                        duration: 0.32,
                        ease: SOFT_EASE,
                      },
                    }}
                    exit={{
                      scale: 0.7,
                      opacity: 0,
                      transition: { duration: 0.16, ease: SOFT_EASE },
                    }}
                  />
                );
              })}

              <AnimatePresence>
                {expanded && indicatorPos && (
                  <motion.div
                    key="indicator"
                    className="absolute rounded-full ring-2 ring-white shadow-xl"
                    style={{
                      width: indicatorSize,
                      height: indicatorSize,
                      background: ribbonColor,
                      left: indicatorPos.x - indicatorSize / 2,
                      top: indicatorPos.y - indicatorSize / 2,
                    }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 480, damping: 30 }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        ref={fabRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 rounded-full shadow-xl ring-1 ring-foreground/10 touch-none select-none"
        style={{
          width: fabSize,
          height: fabSize,
          background: fabBackground,
          bottom: fabInset,
          right: fabInset,
        }}
        animate={{
          scale: previewColor ? 1.06 : pressed ? 0.92 : 1,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        aria-label="Open colour picker"
      />
    </>
  );
}
