"use client";

import {
  AnimatePresence,
  motion,
  useSpring,
  useTransform,
} from "motion/react";
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
  toneInner: number; // layer-3 (tone plane) inner radius
  toneOuter: number; // layer-3 (tone plane) outer radius
  toneSpanDeg: number; // angular width of the tone plane
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
  swatchSize: 30,
  arcRadius: 124,
  ribbonInner: 154,
  ribbonOuter: 184,
  toneInner: 200,
  toneOuter: 280,
  toneSpanDeg: 55,
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

export function ColorPickerFabV8({
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
    toneInner,
    toneOuter,
    toneSpanDeg,
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

  // -------- Layer 3: tone plane (lightness × chroma) --------
  // Span / radial helpers that don't depend on the tone arc's centre angle.
  const toneSpan = toneSpanDeg;
  const toneMid = (toneInner + toneOuter) / 2;
  const toneLocalC = toneOuter;
  const toneEnterThreshold = ribbonOuter + 12;
  const polarTone = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: toneLocalC + r * Math.cos(rad),
      y: toneLocalC + r * Math.sin(rad),
    };
  };
  // Buffer applied to the tone arc's chroma mask: the axis-aligned terminal
  // cap shifts the clip-path's inner endpoint a few degrees past
  // toneStartDeg, into the conic-gradient's wrap-around region. Without a
  // buffer the mask reads as fully opaque there, so the chromatic layer
  // leaks through as a thin saturated slice on the grey side. Shifting the
  // gradient back by this many degrees (and adding a flat transparent zone
  // at the head) keeps the overshoot inside the transparent band.
  const TONE_MASK_BUFFER_DEG = 18;

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

  // Tone-plane hit detection has two phases:
  //  1. "Radial only" — pointer is past the ribbon. This is what triggers the
  //     tone arc to appear AND determines the entry angle.
  //  2. "In tone arc" — pointer is inside the locked tone arc shape. This is
  //     what drives picking and indicator behaviour.
  const inToneBand = dist >= toneEnterThreshold && dist <= toneOuter + 40;
  const inToneRadial =
    effOpen && effPointer !== null && fabDist > fabSize / 2 && inToneBand;

  // Lock the tone arc's centre angle to the pointer's angle on first entry,
  // so the plane appears centred on whatever direction the user dragged from.
  const lockedToneCenterRef = useRef<number | null>(null);
  const lockedToneHueRef = useRef<number | null>(null);
  // Lock the preview ribbon's angular position to where the pointer was on
  // the ribbon at the moment the user crossed into the tone band. The tone
  // arc is fixed at its entry angle, so the preview should be too.
  const lockedPreviewArcAngleRef = useRef<number | null>(null);
  const wasInToneRef = useRef(false);
  // Compute ribbon hue at the pointer angle (used to lock the tone hue, even
  // when the pointer is already past the ribbon radially).
  const ribbonHueAtPointer = (() => {
    if (arcSpanDeg <= 0) return 0;
    const t = Math.max(0, Math.min(1, ribbonPos / arcSpanDeg));
    return t * 360;
  })();
  if (inToneRadial) {
    if (!wasInToneRef.current) {
      lockedToneCenterRef.current = pointerDeg;
      lockedToneHueRef.current = ribbonHueAtPointer;
      lockedPreviewArcAngleRef.current = ribbonStartDeg + ribbonPos;
      wasInToneRef.current = true;
    }
  } else {
    wasInToneRef.current = false;
    if (!effOpen) {
      lockedToneCenterRef.current = null;
      lockedToneHueRef.current = null;
      lockedPreviewArcAngleRef.current = null;
    }
  }
  // Clamp the tone arc's centre so its angular range never extends past the
  // ribbon's. The clamp shifts the centre rather than truncating the span; if
  // the tone span is wider than the ribbon, it falls back to the midpoint.
  const toneMinBoundary = ribbonStartDeg;
  const toneMaxBoundary = ribbonEndDeg;
  const toneHalfSpan = toneSpan / 2;
  const toneMinCenter = toneMinBoundary + toneHalfSpan;
  const toneMaxCenter = toneMaxBoundary - toneHalfSpan;
  let toneCenterDeg = lockedToneCenterRef.current ?? arcCenterDeg;
  if (toneMinCenter > toneMaxCenter) {
    toneCenterDeg = (toneMinBoundary + toneMaxBoundary) / 2;
  } else {
    toneCenterDeg = Math.max(toneMinCenter, Math.min(toneMaxCenter, toneCenterDeg));
  }
  const toneStartDeg = toneCenterDeg - toneHalfSpan;
  const toneEndDeg = toneCenterDeg + toneHalfSpan;
  const toneStartPos = ((toneStartDeg % 360) + 360) % 360;

  // Tone geometry (paths, etc.) — recomputed each render based on toneCenter.
  const toneStartRad = (toneStartDeg * Math.PI) / 180;
  const toneEndRad = (toneEndDeg * Math.PI) / 180;
  // Caps are radial by default, but switch to axis-aligned (vertical for the
  // right cap / horizontal for the left cap) when the tone arc has been
  // clamped to that side's boundary — so the terminal edge reads as a clean
  // screen-axis line rather than a tilted radial cut.
  const toneStartInnerRadial = polarTone(toneInner, toneStartDeg);
  const toneStartOuter = polarTone(toneOuter, toneStartDeg);
  const toneEndInnerRadial = polarTone(toneInner, toneEndDeg);
  const toneEndOuter = polarTone(toneOuter, toneEndDeg);

  const TERMINAL_EPSILON = 0.01;
  const isClamped = toneMinCenter <= toneMaxCenter;
  const atRightTerminal =
    isClamped && toneCenterDeg >= toneMaxCenter - TERMINAL_EPSILON;
  const atLeftTerminal =
    isClamped && toneCenterDeg <= toneMinCenter + TERMINAL_EPSILON;

  // Vertical cap inner endpoint = inner arc intersection with x = toneEndOuter.x
  // (upper intersection — the one above local centre in y-down screen).
  const rightCapAxisDx = toneEndOuter.x - toneLocalC;
  const rightCapAxisYOff = -Math.sqrt(
    Math.max(0, toneInner * toneInner - rightCapAxisDx * rightCapAxisDx),
  );
  const toneEndInnerAxis = {
    x: toneEndOuter.x,
    y: toneLocalC + rightCapAxisYOff,
  };
  // Horizontal cap inner endpoint = inner arc intersection with y = toneStartOuter.y
  // (left intersection — the one to the left of local centre).
  const leftCapAxisDy = toneStartOuter.y - toneLocalC;
  const leftCapAxisXOff = -Math.sqrt(
    Math.max(0, toneInner * toneInner - leftCapAxisDy * leftCapAxisDy),
  );
  const toneStartInnerAxis = {
    x: toneLocalC + leftCapAxisXOff,
    y: toneStartOuter.y,
  };

  const toneEndInner = atRightTerminal ? toneEndInnerAxis : toneEndInnerRadial;
  const toneStartInner = atLeftTerminal ? toneStartInnerAxis : toneStartInnerRadial;

  const innerRightAngleDeg =
    (Math.atan2(toneEndInner.y - toneLocalC, toneEndInner.x - toneLocalC) * 180) /
    Math.PI;
  const innerLeftAngleDeg =
    (Math.atan2(toneStartInner.y - toneLocalC, toneStartInner.x - toneLocalC) *
      180) /
    Math.PI;
  let innerSubtended = innerRightAngleDeg - innerLeftAngleDeg;
  if (innerSubtended > 180) innerSubtended -= 360;
  if (innerSubtended < -180) innerSubtended += 360;
  const toneInnerLarge = Math.abs(innerSubtended) > 180 ? 1 : 0;
  const toneOuterLarge = toneSpan > 180 ? 1 : 0;

  // Builds a tone-arc clip path with the same quadratic-fillet corner
  // rounding the ribbon uses, parameterised on the four arc endpoints so we
  // can reuse it for both the real tone arc (with possibly-axis-aligned end
  // caps) and the radial-cap preview path.
  const buildTonePath = (
    startOuter: { x: number; y: number },
    startInner: { x: number; y: number },
    endOuter: { x: number; y: number },
    endInner: { x: number; y: number },
    startOuterDeg: number,
    endOuterDeg: number,
    startInnerDeg: number,
    endInnerDeg: number,
    innerLargeFlag: number,
    outerLargeFlag: number,
  ) => {
    const cR = cornerR;
    const oStep = ((cR / toneOuter) * 180) / Math.PI;
    const iStep = ((cR / Math.max(1, toneInner)) * 180) / Math.PI;
    // Cap unit vectors (outer → inner along each cap).
    const norm = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    };
    const rDir = norm(endInner.x - endOuter.x, endInner.y - endOuter.y);
    const lDir = norm(startInner.x - startOuter.x, startInner.y - startOuter.y);
    const endOuterCapIn = {
      x: endOuter.x + cR * rDir.x,
      y: endOuter.y + cR * rDir.y,
    };
    const endInnerCapIn = {
      x: endInner.x - cR * rDir.x,
      y: endInner.y - cR * rDir.y,
    };
    const startInnerCapIn = {
      x: startInner.x - cR * lDir.x,
      y: startInner.y - cR * lDir.y,
    };
    const startOuterCapIn = {
      x: startOuter.x + cR * lDir.x,
      y: startOuter.y + cR * lDir.y,
    };
    const endOuterArcIn = polarTone(toneOuter, endOuterDeg - oStep);
    const startOuterArcIn = polarTone(toneOuter, startOuterDeg + oStep);
    const endInnerArcIn = polarTone(toneInner, endInnerDeg - iStep);
    const startInnerArcIn = polarTone(toneInner, startInnerDeg + iStep);
    return (
      `M ${fp(endOuterCapIn)}` +
      ` L ${fp(endInnerCapIn)}` +
      ` Q ${fp(endInner)} ${fp(endInnerArcIn)}` +
      ` A ${toneInner} ${toneInner} 0 ${innerLargeFlag} 0 ${fp(startInnerArcIn)}` +
      ` Q ${fp(startInner)} ${fp(startInnerCapIn)}` +
      ` L ${fp(startOuterCapIn)}` +
      ` Q ${fp(startOuter)} ${fp(startOuterArcIn)}` +
      ` A ${toneOuter} ${toneOuter} 0 ${outerLargeFlag} 1 ${fp(endOuterArcIn)}` +
      ` Q ${fp(endOuter)} ${fp(endOuterCapIn)}` +
      ` Z`
    );
  };

  const tonePath = buildTonePath(
    toneStartOuter,
    toneStartInner,
    toneEndOuter,
    toneEndInner,
    toneStartDeg,
    toneEndDeg,
    innerLeftAngleDeg,
    innerRightAngleDeg,
    toneInnerLarge,
    toneOuterLarge,
  );

  // Preview tone arc path: tracks the pointer's angle on the ribbon (clamped
  // to the tone arc's allowed centre range) and renders with simple radial
  // caps. Used by the glass outline shown before the user pushes out into
  // the tone band — the equivalent of the ribbon-outline preview that hints
  // at layer 2 while a swatch is hovered.
  const ribbonAnglePointer = ribbonStartDeg + ribbonPos;
  const previewToneCenterDeg = toneMinCenter > toneMaxCenter
    ? (toneMinBoundary + toneMaxBoundary) / 2
    : Math.max(toneMinCenter, Math.min(toneMaxCenter, ribbonAnglePointer));
  const previewToneStartDeg = previewToneCenterDeg - toneHalfSpan;
  const previewToneEndDeg = previewToneCenterDeg + toneHalfSpan;
  const previewToneStartInner = polarTone(toneInner, previewToneStartDeg);
  const previewToneStartOuter = polarTone(toneOuter, previewToneStartDeg);
  const previewToneEndInner = polarTone(toneInner, previewToneEndDeg);
  const previewToneEndOuter = polarTone(toneOuter, previewToneEndDeg);
  const previewToneLarge = toneSpan > 180 ? 1 : 0;
  const previewTonePath = buildTonePath(
    previewToneStartOuter,
    previewToneStartInner,
    previewToneEndOuter,
    previewToneEndInner,
    previewToneStartDeg,
    previewToneEndDeg,
    previewToneStartDeg,
    previewToneEndDeg,
    previewToneLarge,
    previewToneLarge,
  );
  const previewToneCenterLocal = polarTone(
    (toneInner + toneOuter) / 2,
    previewToneCenterDeg,
  );

  // Pointer position within the now-locked tone arc.
  const toneRawOffset = (((pointerDeg - toneStartPos) % 360) + 360) % 360;
  let tonePosAngular: number;
  if (toneRawOffset <= toneSpan) tonePosAngular = toneRawOffset;
  else if (toneRawOffset > (toneSpan + 360) / 2) tonePosAngular = 0;
  else tonePosAngular = toneSpan;
  const inToneAngular =
    toneRawOffset <= toneSpan + 25 || toneRawOffset >= 360 - 25;
  const inToneArc = inToneRadial && inToneAngular;

  // Picker is "in range" when the pointer is over the swatch fan, ribbon, or
  // tone plane (whichever is closest along the gesture).
  const inArc = inSwatchArc || inRibbonArc || inToneArc;
  const expanded = inArc && dist > expandThreshold;

  // --- v8 touch-lift: as the thumb approaches a layer, push it slightly out
  // from under the finger so the user can see what they're selecting. The
  // amount ramps with the pointer's radial position within the layer's band,
  // so each swatch/ribbon segment glides outward to meet the thumb.
  const SWATCH_LIFT_MAX = 14;
  const RIBBON_LIFT_MAX = 12;
  const RIBBON_THICKEN_MAX = 0.06; // scale factor on top of lift
  // How close to the swatch ring the thumb has to be before swatches start
  // lifting. Lifts fully when the thumb is at or past the swatch ring.
  const overSwatches = inSwatchArc && dist > fabR + 8;
  const swatchLiftT = overSwatches
    ? Math.max(
        0,
        Math.min(1, (dist - (fabR + 8)) / Math.max(1, arcRadius - (fabR + 8))),
      )
    : 0;
  const swatchLift = swatchLiftT * SWATCH_LIFT_MAX;
  const overRibbon = expanded && inRibbonArc && !inToneArc;
  const ribbonLiftT = overRibbon
    ? Math.max(
        0,
        Math.min(
          1,
          (dist - ribbonInner) / Math.max(1, ribbonOuter - ribbonInner),
        ),
      )
    : 0;
  const ribbonScale = 1 + ribbonLiftT * RIBBON_THICKEN_MAX;
  const ribbonExtraLift = ribbonLiftT * RIBBON_LIFT_MAX;

  // Each swatch's colour is derived from the ribbon hue at its angular
  // position, so the swatch and the ribbon segment directly outside it always
  // render the same OKLCH colour.
  const swatchN = swatches.length;
  const swatchData = swatches.map((_, i) => {
    const deg =
      swatchN > 1
        ? swatchStartDeg + i * (swatchSpan / (swatchN - 1))
        : swatchStartDeg;
    let t = arcSpanDeg > 0 ? (deg - ribbonStartDeg) / arcSpanDeg : 0;
    t = Math.max(0, Math.min(1, t));
    const hue = t * 360;
    return { hue, color: `oklch(${ribbonL} ${ribbonC} ${hue})` };
  });

  // Live ribbon hue under the thumb (full 360° wheel mapping).
  let ribbonHue = 0;
  if (expanded && inRibbonArc) {
    const t = arcSpanDeg > 0 ? ribbonPos / arcSpanDeg : 0;
    ribbonHue = t * 360;
  } else if (expanded && activeIdx >= 0) {
    ribbonHue = swatchData[activeIdx].hue;
  }
  const ribbonColor = `oklch(${ribbonL} ${ribbonC} ${ribbonHue})`;

  // Locked tone hue (snapshotted on entry to the tone arc, used by gradients).
  const lockedToneHue = lockedToneHueRef.current ?? ribbonHueAtPointer;

  // Tone L (radial) × C (tangential) from pointer position.
  // Tangential at left  edge (toneStart) = C 0 (grey side)
  // Tangential at right edge (toneEnd)   = C max (vibrant side)
  // Radial at inner edge = L 0 (dark)
  // Radial at outer edge = L 1 (light)
  const TONE_C_MAX = 0.32;
  let toneL = 0.6;
  let toneC = TONE_C_MAX;
  if (inToneArc) {
    toneL = Math.max(
      0,
      Math.min(1, (dist - toneInner) / Math.max(1, toneOuter - toneInner)),
    );
    toneC =
      TONE_C_MAX *
      Math.max(0, Math.min(1, toneSpan > 0 ? tonePosAngular / toneSpan : 0));
  }
  const toneColor = `oklch(${toneL.toFixed(3)} ${toneC.toFixed(3)} ${lockedToneHue})`;

  // Conic hue stops cover the full 360° wheel across the visible ribbon,
  // with the inner-arc overhang padded by α_diff on each side (clamped to the
  // matching end hue so the overhang stays coloured).
  const hueStops = (() => {
    const conicSpan = arcSpanDeg + 2 * alphaDiffDeg;
    const N = 49;
    const stops: string[] = [];
    for (let i = 0; i < N; i++) {
      const conicDeg = (i / (N - 1)) * conicSpan;
      // Position along the *visible* ribbon (0..1), clamped to the inner-arc
      // overhang regions so the ends read as hue 0 / hue 360.
      const visibleT = Math.max(
        0,
        Math.min(1, (conicDeg - alphaDiffDeg) / arcSpanDeg),
      );
      const hue = visibleT * 360;
      stops.push(`oklch(${ribbonL} ${ribbonC} ${hue}) ${conicDeg.toFixed(3)}deg`);
    }
    return stops.join(", ");
  })();

  // Live preview color shown on the FAB while dragging.
  const previewColor = inToneArc
    ? toneColor
    : expanded
      ? ribbonColor
      : activeIdx >= 0
        ? swatchData[activeIdx].color
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
    if (inToneArc) {
      setPicked(toneColor);
      onPick?.(toneColor);
      return;
    }
    if (expanded) {
      setPicked(ribbonColor);
      onPick?.(ribbonColor);
      return;
    }
    if (activeIdx >= 0) {
      const c = swatchData[activeIdx].color;
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
  const ribbonIndicatorPos =
    expanded && !inToneArc ? polar(cx, cy, ribbonMid, indicatorDeg) : null;
  // Tone indicator follows the pointer freely inside the tone band (clamped).
  const toneIndicatorPos = inToneArc && effPointer
    ? polar(
        cx,
        cy,
        Math.max(toneInner + indicatorSize / 2, Math.min(toneOuter - indicatorSize / 2, dist)),
        toneStartDeg + tonePosAngular,
      )
    : null;
  // Small secondary marker: shows where the *ribbon's* original L/C lands
  // inside the tone plane, so the user can see how their current tone pick
  // relates to the colour they dragged out from on the ribbon.
  const toneRibbonMarkerSize = Math.max(10, Math.round(indicatorSize * 0.5));
  const toneRibbonMarkerPos = inToneArc
    ? (() => {
        const cT = Math.max(0, Math.min(1, ribbonC / TONE_C_MAX));
        const angleDeg = toneStartDeg + cT * toneSpan;
        const lClamped = Math.max(0, Math.min(1, ribbonL));
        const r = toneInner + lClamped * (toneOuter - toneInner);
        const rClamped = Math.max(
          toneInner + toneRibbonMarkerSize / 2,
          Math.min(toneOuter - toneRibbonMarkerSize / 2, r),
        );
        return polar(cx, cy, rClamped, angleDeg);
      })()
    : null;
  const toneRibbonMarkerColor = `oklch(${ribbonL} ${ribbonC} ${lockedToneHue})`;

  // Preview ribbon: tangential arc-segment indicator that floats just outside
  // whichever layer is currently active, so the live colour stays visible
  // past the user's thumb / FAB. Radius moves outward as the gesture
  // progresses: at swatch hover, just past where the ribbon will appear; on
  // the ribbon (or in the tone arc), just past the tone UI. Centre angle is
  // clamped to the ribbon's angular extent (same idea as the tone arc's
  // centre clamp) so the arc never slides off the side or bottom of the
  // screen at the picker's terminal edges.
  const PREVIEW_ARC_GAP = 24;
  const PREVIEW_ARC_THICKNESS = 14;
  const PREVIEW_ARC_HALF_WIDTH_DEG = 14;
  // Extra margin past the picker's terminal angles so the preview arc's
  // ends never reach into the off-screen territory below the FAB / past
  // the right edge — even on small mobile viewports.
  const PREVIEW_ARC_EDGE_MARGIN_DEG = 10;
  // When the thumb gets close to the tone arc's outer edge it covers the
  // preview ribbon. Push the preview further out the closer the thumb
  // gets to the outer rim, up to this many extra pixels at the rim.
  const PREVIEW_ARC_THUMB_LIFT = 28;
  let previewArcAngleDeg: number | null = null;
  let previewArcRadius = 0;
  if (inToneArc) {
    previewArcAngleDeg =
      lockedPreviewArcAngleRef.current ?? toneStartDeg + tonePosAngular;
    const thumbRadialT = Math.max(
      0,
      Math.min(
        1,
        (dist - toneInner) / Math.max(1, toneOuter - toneInner),
      ),
    );
    previewArcRadius =
      toneOuter + PREVIEW_ARC_GAP + thumbRadialT * PREVIEW_ARC_THUMB_LIFT;
  } else if (expanded && inRibbonArc) {
    previewArcAngleDeg = ribbonStartDeg + ribbonPos;
    previewArcRadius = toneOuter + PREVIEW_ARC_GAP;
  } else if (!expanded && activeIdx >= 0) {
    previewArcAngleDeg = swatchStartDeg + activeIdx * swatchStep;
    previewArcRadius = ribbonOuter + PREVIEW_ARC_GAP;
  }
  if (previewArcAngleDeg !== null) {
    const minCenter =
      ribbonStartDeg + PREVIEW_ARC_HALF_WIDTH_DEG + PREVIEW_ARC_EDGE_MARGIN_DEG;
    const maxCenter =
      ribbonEndDeg - PREVIEW_ARC_HALF_WIDTH_DEG - PREVIEW_ARC_EDGE_MARGIN_DEG;
    if (minCenter <= maxCenter) {
      previewArcAngleDeg = Math.max(
        minCenter,
        Math.min(maxCenter, previewArcAngleDeg),
      );
    } else {
      previewArcAngleDeg = (ribbonStartDeg + ribbonEndDeg) / 2;
    }
  }

  const arcSegmentPath = (
    originX: number,
    originY: number,
    r: number,
    midDeg: number,
    halfWidthDeg: number,
  ) => {
    const startDeg = midDeg - halfWidthDeg;
    const endDeg = midDeg + halfWidthDeg;
    const sRad = (startDeg * Math.PI) / 180;
    const eRad = (endDeg * Math.PI) / 180;
    const sx = originX + r * Math.cos(sRad);
    const sy = originY + r * Math.sin(sRad);
    const ex = originX + r * Math.cos(eRad);
    const ey = originY + r * Math.sin(eRad);
    const large = halfWidthDeg * 2 > 180 ? 1 : 0;
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  };

  // Smooth the preview arc's angle and radius with a spring so the
  // indicator glides between positions instead of jumping (especially
  // noticeable when stepping between discrete swatch positions). When the
  // preview first appears we snap without animating, then spring on
  // subsequent updates.
  const previewAngleSpring = useSpring(0, { stiffness: 360, damping: 28 });
  const previewRadiusSpring = useSpring(0, { stiffness: 360, damping: 28 });
  const previewVisibleRef = useRef(false);
  useEffect(() => {
    if (previewArcAngleDeg !== null) {
      if (!previewVisibleRef.current) {
        previewAngleSpring.jump(previewArcAngleDeg);
        previewRadiusSpring.jump(previewArcRadius);
        previewVisibleRef.current = true;
      } else {
        previewAngleSpring.set(previewArcAngleDeg);
        previewRadiusSpring.set(previewArcRadius);
      }
    } else {
      previewVisibleRef.current = false;
    }
  }, [previewArcAngleDeg, previewArcRadius, previewAngleSpring, previewRadiusSpring]);
  const previewPathD = useTransform(
    [previewAngleSpring, previewRadiusSpring],
    ([a, r]: number[]) =>
      arcSegmentPath(cx, cy, r, a, PREVIEW_ARC_HALF_WIDTH_DEG),
  );

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
                    animate={{ scale: ribbonScale, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{
                      scale: { type: "spring", stiffness: 320, damping: 28 },
                      opacity: { duration: openSec * 0.6, ease: SOFT_EASE },
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Layer 3: tone plane (lightness × chroma for a locked hue).
                  Composed from two L=0→1 radial gradients stacked under a
                  tangential conic mask:
                    – bottom layer is the *neutral* lightness column
                      (black → grey → white) shown on the low-chroma edge;
                    – top layer is the *chromatic* lightness column
                      (black → hue → white), masked so it's transparent at
                      the low-C edge and fully opaque at the high-C edge.
                  This models `oklch(L, C, hue)` where L varies radially and
                  C varies tangentially — the previous single-radial-plus-
                  conic-overlay couldn't represent the grey column at low C
                  or a vibrant column at high C across all L. */}
              <AnimatePresence>
                {inToneArc && (
                  <motion.div
                    key="tone"
                    className="absolute"
                    style={{
                      width: 2 * toneOuter,
                      height: 2 * toneOuter,
                      left: cx - toneOuter,
                      top: cy - toneOuter,
                      clipPath: `path('${tonePath}')`,
                      WebkitClipPath: `path('${tonePath}')`,
                      filter: "drop-shadow(0 6px 22px rgba(0,0,0,0.22))",
                    }}
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ duration: openSec * 0.9, ease: SOFT_EASE }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at ${toneLocalC}px ${toneLocalC}px in oklch, oklch(0 0 ${lockedToneHue}) ${toneInner}px, oklch(1 0 ${lockedToneHue}) ${toneOuter}px)`,
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at ${toneLocalC}px ${toneLocalC}px in oklch, oklch(0 ${TONE_C_MAX} ${lockedToneHue}) ${toneInner}px, oklch(1 ${TONE_C_MAX} ${lockedToneHue}) ${toneOuter}px)`,
                        maskImage: `conic-gradient(from ${(((toneStartDeg + 90 - TONE_MASK_BUFFER_DEG) % 360) + 360) % 360}deg at ${toneLocalC}px ${toneLocalC}px, rgba(0,0,0,0) 0deg, rgba(0,0,0,0) ${TONE_MASK_BUFFER_DEG}deg, rgba(0,0,0,1) ${TONE_MASK_BUFFER_DEG + toneSpan}deg, rgba(0,0,0,1) 360deg)`,
                        WebkitMaskImage: `conic-gradient(from ${(((toneStartDeg + 90 - TONE_MASK_BUFFER_DEG) % 360) + 360) % 360}deg at ${toneLocalC}px ${toneLocalC}px, rgba(0,0,0,0) 0deg, rgba(0,0,0,0) ${TONE_MASK_BUFFER_DEG}deg, rgba(0,0,0,1) ${TONE_MASK_BUFFER_DEG + toneSpan}deg, rgba(0,0,0,1) 360deg)`,
                      }}
                    />
                  </motion.div>
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

              {/* Tone-plane outline preview: shown while expanded on the
                  ribbon, before the user has pushed out into the tone band.
                  Same glass treatment as the ribbon-outline preview. */}
              <AnimatePresence>
                {expanded && !inToneArc && (
                  <motion.div
                    key="tone-outline"
                    className="absolute"
                    style={{
                      width: 2 * toneOuter,
                      height: 2 * toneOuter,
                      left: cx - toneOuter,
                      top: cy - toneOuter,
                    }}
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ duration: openSec * 0.9, ease: SOFT_EASE }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: `path('${previewTonePath}')`,
                        WebkitClipPath: `path('${previewTonePath}')`,
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        background: "rgba(255,255,255,0.14)",
                      }}
                    />
                    <svg
                      className="absolute inset-0"
                      style={{ overflow: "visible" }}
                      viewBox={`0 0 ${2 * toneOuter} ${2 * toneOuter}`}
                    >
                      <g
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth={2.75}
                        strokeLinecap="round"
                      >
                        <line
                          x1={previewToneCenterLocal.x - 6}
                          y1={previewToneCenterLocal.y}
                          x2={previewToneCenterLocal.x + 6}
                          y2={previewToneCenterLocal.y}
                        />
                        <line
                          x1={previewToneCenterLocal.x}
                          y1={previewToneCenterLocal.y - 6}
                          x2={previewToneCenterLocal.x}
                          y2={previewToneCenterLocal.y + 6}
                        />
                      </g>
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>

              {swatchData.map((s, i) => {
                const deg = swatchStartDeg + i * swatchStep;
                const { x, y } = polar(cx, cy, arcRadius, deg);
                const isActive = !expanded && i === activeIdx;
                const swatchRad = (deg * Math.PI) / 180;
                const liftDx = swatchLift * Math.cos(swatchRad);
                const liftDy = swatchLift * Math.sin(swatchRad);
                return (
                  <motion.div
                    key={i}
                    className="absolute rounded-full ring-1 ring-foreground/10 shadow-lg"
                    style={{
                      width: swatchSize,
                      height: swatchSize,
                      background: s.color,
                      left: x - swatchSize / 2,
                      top: y - swatchSize / 2,
                    }}
                    initial={{ scale: 0.7, opacity: 0, x: 0, y: 0 }}
                    animate={{
                      scale: isActive ? 1.2 : 1,
                      opacity: expanded ? 0.5 : 1,
                      x: liftDx,
                      y: liftDy,
                      transition: {
                        delay: i * 0.022,
                        scale: { type: "spring", stiffness: 360, damping: 28 },
                        opacity: { duration: 0.32, ease: SOFT_EASE },
                        x: { type: "spring", stiffness: 360, damping: 28 },
                        y: { type: "spring", stiffness: 360, damping: 28 },
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
                {ribbonIndicatorPos && (
                  <motion.div
                    key="indicator"
                    className="absolute rounded-full ring-2 ring-white shadow-xl"
                    style={{
                      width: indicatorSize,
                      height: indicatorSize,
                      background: ribbonColor,
                      left: ribbonIndicatorPos.x - indicatorSize / 2,
                      top: ribbonIndicatorPos.y - indicatorSize / 2,
                    }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 480, damping: 30 }}
                  />
                )}
                {toneRibbonMarkerPos && (
                  <motion.div
                    key="tone-ribbon-marker"
                    className="absolute rounded-full"
                    style={{
                      width: toneRibbonMarkerSize,
                      height: toneRibbonMarkerSize,
                      background: toneRibbonMarkerColor,
                      boxShadow:
                        "0 0 0 1.5px rgba(255,255,255,0.95), 0 0 0 2.5px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.25)",
                      left: toneRibbonMarkerPos.x - toneRibbonMarkerSize / 2,
                      top: toneRibbonMarkerPos.y - toneRibbonMarkerSize / 2,
                    }}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  />
                )}
                {toneIndicatorPos && (
                  <motion.div
                    key="tone-indicator"
                    className="absolute rounded-full ring-2 ring-white shadow-xl"
                    style={{
                      width: indicatorSize,
                      height: indicatorSize,
                      background: toneColor,
                      left: toneIndicatorPos.x - indicatorSize / 2,
                      top: toneIndicatorPos.y - indicatorSize / 2,
                    }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 480, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              {/* Preview ribbon: floating arc-segment colour preview that
                  sits just outside whichever layer is active, so the live
                  colour stays visible past the user's thumb. */}
              <AnimatePresence>
                {previewColor && previewArcAngleDeg !== null && (
                  <motion.svg
                    key="preview-ribbon"
                    className="absolute pointer-events-none"
                    style={{ inset: 0, overflow: "visible" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: SOFT_EASE }}
                  >
                    <motion.path
                      d={previewPathD}
                      stroke="rgba(255,255,255,0.95)"
                      strokeWidth={PREVIEW_ARC_THICKNESS + 3}
                      strokeLinecap="round"
                      fill="none"
                      style={{
                        filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.25))",
                      }}
                    />
                    <motion.path
                      d={previewPathD}
                      stroke={previewColor}
                      strokeWidth={PREVIEW_ARC_THICKNESS}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </motion.svg>
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
