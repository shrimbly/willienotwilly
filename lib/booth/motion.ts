// Booth's motion, ported from studiovoice/app/Sources/Booth/Shell/Motion.swift,
// UI/PopoverMotion.swift, Shell/PopoverPanel.swift, Shell/StatusItemController.swift and
// BoothCore/SignatureReveal.swift (SpringCurve, PanelOpening). Seconds throughout, as there.

/** A CSS cubic-bezier's control points. */
export type Bezier = readonly [number, number, number, number];

/** The curves Booth names after the CSS transitions they port (Motion.swift `CubicBezier`). */
export const CURVES = {
  /** The menu bar button's `transform 240ms cubic-bezier(.34,1.56,.64,1)`. */
  iconSpring: [0.34, 1.56, 0.64, 1],
  /** An even ease in and out, for one state dissolving into another. */
  inOut: [0.45, 0, 0.55, 1],
  /** CSS `ease`, for fades and colour changes. */
  cssEase: [0.25, 0.1, 0.25, 1],
  /** A strong ease-out for UI that answers an action. */
  easeOut: [0.23, 1, 0.32, 1],
  /** The Settings switch knob's slight overshoot. */
  switchKnob: [0.3, 1.4, 0.6, 1],
} as const satisfies Record<string, Bezier>;

/** `cubic-bezier(…)` for a style. */
export function cssBezier(curve: Bezier): string {
  return `cubic-bezier(${curve.join(", ")})`;
}

/**
 * A cubic-bezier timing curve solved the way browsers solve it (WebKit's UnitBezier, as
 * Motion.swift does), so motion driven from script keeps a curve's overshoot.
 */
export function bezierEase([x1, y1, x2, y2]: Bezier): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    while (low < high) {
      const sample = sampleX(t);
      if (Math.abs(sample - x) < 1e-6) return t;
      if (x > sample) low = t;
      else high = t;
      t = (low + high) / 2;
      if (high - low < 1e-6) break;
    }
    return t;
  };
  return (progress) => (progress <= 0 ? 0 : progress >= 1 ? 1 : sampleY(solve(progress)));
}

/**
 * A spring's progress from 0 to 1, set by feel the way SwiftUI and Core Animation set one:
 * a perceptual duration and a bounce. Stiffness (2π / duration)², damping
 * 4π (1 − bounce) / duration, unit mass, from rest (BoothCore `SpringCurve`).
 */
export function springValue(perceptualDuration: number, bounce: number, seconds: number): number {
  if (seconds <= 0) return 0;
  const omega = (2 * Math.PI) / perceptualDuration;
  const zeta = 1 - bounce;
  if (zeta >= 1) return 1 - (1 + omega * seconds) * Math.exp(-omega * seconds);
  const decay = zeta * omega;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-decay * seconds) * (Math.cos(damped * seconds) + (decay / damped) * Math.sin(damped * seconds));
}

/**
 * The spring as a motion `ease` over `duration` seconds, so `animate()` plays Booth's own
 * spring rather than motion's (whose visualDuration is measured differently). It reaches 1
 * exactly at the end; by then the spring has settled to well under a thousandth.
 */
export function springEase(perceptualDuration: number, bounce: number, duration: number) {
  return (progress: number) => (progress >= 1 ? 1 : springValue(perceptualDuration, bounce, progress * duration));
}

/** The popover opening and closing (PopoverPanel.swift, BoothCore `PanelOpening`). */
export const PANEL = {
  /** It fades in over 150 ms on CSS ease… */
  openFade: 0.15,
  /** …while it grows from 95% and drops 6 pt into place about a pivot under the icon… */
  openScale: 0.95,
  lift: 6,
  /** …on this spring (perceptual duration, bounce). */
  spring: { perceptualDuration: 0.32, bounce: 0.12 },
  /** How long the spring is played for: it has settled to under 0.1% by then. */
  springSeconds: 0.6,
  /** Closing is quicker and smaller, ease-out: fade 140 ms, shrink to 98% and lift 3 pt in 160 ms. */
  closeFade: 0.14,
  closePop: 0.16,
  closeScale: 0.98,
  closeLift: 3,
  /** The glass hangs this far under the menu bar and keeps this far from the screen's edge. */
  menuBarGap: 6,
  screenMargin: 8,
} as const;

/** The panel's scale and how far above its resting place it is, `seconds` into opening. */
export function panelPose(seconds: number): { scale: number; lift: number } {
  const x = springValue(PANEL.spring.perceptualDuration, PANEL.spring.bounce, seconds);
  return { scale: PANEL.openScale + (1 - PANEL.openScale) * x, lift: PANEL.lift * (1 - x) };
}

/** The menu bar icon (StatusItemController.swift). */
export const ICON = {
  /** Grows to this under a dragged file… */
  targetScale: 1.14,
  /** …pulses to this for 150 ms as files are accepted… */
  pulseScale: 1.25,
  pulseSeconds: 0.15,
  /** …over 240 ms on `CURVES.iconSpring`. */
  scaleSeconds: 0.24,
  /** A file held over the icon this long springs the popover open. */
  springLoadSeconds: 0.7,
} as const;

/** The popover's content transitions (PopoverMotion.swift). */
export const POPOVER_MOTION = {
  /** Content leaving softens to blur 4 over 220 ms and fades over 200 ms after 50 ms (inOut). */
  swapOutSoften: 0.22,
  swapOutFade: 0.2,
  swapOutFadeDelay: 0.05,
  /** Content arriving starts at 70 ms, fades in over 280 ms and focuses over 320 ms from 1.5× the blur. */
  swapInDelay: 0.07,
  swapInFade: 0.28,
  swapInFocus: 0.32,
  swapInBlurScale: 1.5,
  /** Footers and the signature hang from the bottom edge and arrive once the frame has nearly grown. */
  swapLastDelay: 0.26,
  /** The frame's height: a 0.45 s spring with no bounce, 90 ms late on a screen change. */
  heightSpring: 0.45,
  screenChangeDelay: 0.09,
  /** Reduce Motion: the frame snaps and the content cross-fades on CSS ease. */
  reducedCrossfade: 0.15,
  /** The frame's fill and the prompt's colour as a file comes over the popover (easeOut). */
  dropHover: 0.2,
  /** The outline's dots joining into a line, CSS ease. */
  outlineJoin: 0.28,
  /** The signature under a dragged file: colour 200 ms, blur 260 ms (CSS ease). */
  signatureInk: 0.2,
  signatureFocus: 0.26,
  /** The Working bar glides linearly between progress updates. */
  progressGlide: 0.25,
  /** Working shows a finished job full for this long before Done takes over (AppModel.finishHold). */
  finishHold: 0.45,
} as const;
