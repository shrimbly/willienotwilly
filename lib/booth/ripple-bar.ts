// The Working screen's ripple bar, ported line for line from
// studiovoice/app/Sources/BoothCore/RippleBar.swift (WorkingSound.dc.html, option J). The whole
// popover is the progress bar: the fill spreads from the left like sound from a speaker, faint
// rings leave the source in bursts and spread through it, and one faint ring runs ahead of it.
//
// Distances are in points on a bar 56 pt tall; times are milliseconds on a free-running clock.

export const RIPPLE = {
  height: 56,
  /** The rings' shared centre: just off the bar's left edge, at mid-height. */
  sourceX: -20,
  midY: 28,
  /** At most one ring leaves the source in each slot this long. */
  slotMilliseconds: 240,
  /** Slots looked back over: enough for a ring to cross the whole bar. */
  slots: 46,
  /** How fast rings travel outward, in points per millisecond. */
  ringSpeed: 0.03,
  /** The faint ring ahead of the fill leaves the front this often. */
  leadMilliseconds: 1800,
  /** The fill's edge is blurred by this radius. */
  fillSoftness: 2.5,
  /** The rings are blurred by this radius. */
  ringSoftness: 0.6,
  /** Points along each ring's visible arc (WorkingScreen.swift `RippleCanvas.samples`). */
  samples: 24,
  /**
   * Snapshots and reduced motion hold the rings at this moment, spread through the fill
   * (WorkingScreen.swift `GlidingRippleBar.stillMilliseconds`).
   */
  stillMilliseconds: 12_000,
} as const;

/** An ellipse about (`sourceX`, `midY`). */
export interface Ring {
  rx: number;
  ry: number;
  alpha: number;
  lineWidth: number;
  /** A faint wide band of pressure drawn around the hairline. */
  bandWidth: number;
  bandAlpha: number;
  /** Stable for the ring's life, so its waver keeps its own shape as it spreads. */
  seed: number;
}

/** The fill's horizontal radius: it reaches the front at mid-height. */
export function fillRadius(front: number): number {
  return front - RIPPLE.sourceX;
}

/** Rings are flatter than circles, so the wavefront bulges forward. */
export function verticalRadius(rx: number): number {
  return 0.5 * rx + 14;
}

/** Repeatable noise, 0–1, for sample `i` of stream `stream`. */
export function rippleNoise(i: number, stream: number): number {
  const v = Math.sin(i * 12.9898 + stream * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}

/** A speech-like level, 0–1, at position `u`: words, syllables inside them, and pauses between. */
export function speechLevel(u: number): number {
  const words = Math.abs(Math.sin(u * 0.061) * Math.sin(u * 0.017 + 1.3));
  const syllables = 0.55 + 0.45 * Math.sin(u * 0.19 + 2 * Math.sin(u * 0.05));
  const pause = Math.sin(u * 0.0093 + 0.6) > -0.55 ? 1 : 0.08;
  return Math.min(1, words * syllables * 1.7 * pause);
}

/**
 * The rings inside a fill whose front is at `front`. Each slot may send out a ring at its own
 * moment within the slot, as strong as the voice was then. Loud passages send most slots'
 * rings and quiet ones few, so rings come in bursts and never sit evenly spaced. Each eases in
 * at the source and fades as it spreads.
 */
export function rippleRings(t: number, front: number): Ring[] {
  const fill = fillRadius(front);
  const slot = Math.floor(t / RIPPLE.slotMilliseconds);
  const rings: Ring[] = [];
  for (let n = 0; n < RIPPLE.slots; n++) {
    const k = slot - n;
    const left = (k + 0.15 + 0.7 * rippleNoise(k, 7)) * RIPPLE.slotMilliseconds;
    const r = (t - left) * RIPPLE.ringSpeed;
    const level = 0.25 + 0.75 * speechLevel(k * 23.3 + 300);
    if (!(rippleNoise(k, 3) < 0.2 + 0.6 * level && r > 0.1 && r < fill - 8)) continue;
    const strength = level * Math.pow(1 - r / fill, 0.8) * smoothstep(0, 12, r);
    rings.push({
      rx: r,
      ry: verticalRadius(r),
      alpha: 0.22 * strength,
      lineWidth: 0.6 + level,
      bandWidth: 4 + 8 * level,
      bandAlpha: 0.06 * strength,
      seed: k,
    });
  }
  return rings;
}

/** The faint ring that leaves the front and fades as it travels ahead. */
export function leadRing(t: number, front: number): Ring {
  const phase = (Math.max(0, t) % RIPPLE.leadMilliseconds) / RIPPLE.leadMilliseconds;
  const r = fillRadius(front) + 4 + 22 * phase;
  return { rx: r, ry: verticalRadius(r), alpha: 0.28 * (1 - phase), lineWidth: 1.4, bandWidth: 0, bandAlpha: 0, seed: 0 };
}

/** How far a ring wavers sideways at height `y`: about ±2 pt, drifting over time. */
export function ringWaver(y: number, seed: number, t: number): number {
  // Swift's % keeps the dividend's sign, as JavaScript's does.
  const s = seed % 997;
  return 1.4 * Math.sin(y * 0.13 + t * 0.0011 + s * 1.7) + 0.9 * Math.sin(y * 0.29 - t * 0.0016 + s * 2.9);
}

/**
 * The part of `ring` that can show (its right-hand side, within a little of the bar's
 * height), as points nudged sideways by the ring's waver (WorkingScreen.swift `arc(of:)`).
 */
export function ringArc(ring: Ring, height: number, t: number): [number, number][] {
  const reach = height / 2 + 6;
  const span = ring.ry > reach ? Math.asin(reach / ring.ry) : Math.PI / 2;
  const points: [number, number][] = [];
  for (let i = 0; i <= RIPPLE.samples; i++) {
    const theta = -span + (2 * span * i) / RIPPLE.samples;
    const y = RIPPLE.midY + ring.ry * Math.sin(theta);
    const x = RIPPLE.sourceX + ring.rx * Math.cos(theta) + ringWaver(y, ring.seed, t);
    points.push([x, y]);
  }
  return points;
}

/**
 * How a text layer fades as the fill's front passes: alpha against the distance from the
 * front in points (negative behind it, inside the fill), linear between points and held
 * beyond the ends (BoothCore `FrontFade`).
 */
export type FrontFade = readonly (readonly [distance: number, alpha: number])[];

export function frontFadeAlpha(fade: FrontFade, distance: number): number {
  if (fade.length === 0) return 1;
  const first = fade[0];
  const last = fade[fade.length - 1];
  if (distance <= first[0]) return first[1];
  if (distance >= last[0]) return last[1];
  for (let i = 1; i < fade.length; i++) {
    const a = fade[i - 1];
    const b = fade[i];
    if (distance <= b[0]) return a[1] + ((b[1] - a[1]) * (distance - a[0])) / (b[0] - a[0]);
  }
  return last[1];
}

/**
 * Gradient stops for a bar `width` wide with the front at `front`: the fade's points that
 * fall within the bar, plus its two edges. `location` runs 0 (left) to 1 (right).
 */
export function frontFadeStops(fade: FrontFade, front: number, width: number): { location: number; alpha: number }[] {
  if (width <= 0) return [{ location: 0, alpha: frontFadeAlpha(fade, -front) }];
  const inside = fade.map(([d]) => front + d).filter((x) => x > 0 && x < width);
  return [0, ...inside, width].map((x) => ({ location: x / width, alpha: frontFadeAlpha(fade, x - front) }));
}

/** The stops as a CSS `linear-gradient(to right, …)` in black, for a mask. */
export function frontFadeMask(fade: FrontFade, front: number, width: number): string {
  const stops = frontFadeStops(fade, front, width).map(
    ({ location, alpha }) => `rgb(0 0 0 / ${alpha.toFixed(4)}) ${(location * 100).toFixed(3)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** One drawing of the file name. The layers' alphas add up to 1 at every distance. */
export interface NameLayer {
  fade: FrontFade;
  /** Gaussian blur radius in points. */
  blur: number;
  opacity: number;
  /** Drawn in the on-fill colour rather than the text colour. */
  onFill: boolean;
}

/**
 * The Working bar's text: percent on the left, the file name on the right. The name stays out
 * of focus until the front reaches it, turns pale as it crosses, and only then comes into
 * focus, in steps, inside the fill. Percent and × simply turn pale as they cross.
 */
export const WORKING_TEXT = {
  /** Percent and × in the text colour, ahead of the front. */
  marks: [
    [-4, 0],
    [8, 1],
  ] as FrontFade,
  /** Percent and × in the on-fill colour, behind the front. */
  marksOnFill: [
    [-4, 1],
    [8, 0],
  ] as FrontFade,
  nameLayers: [
    { fade: [[-4, 0], [8, 1]], blur: 2.6, opacity: 0.75, onFill: false },
    { fade: [[-30, 0], [-16, 1], [-4, 1], [8, 0]], blur: 2.6, opacity: 0.85, onFill: true },
    { fade: [[-48, 0], [-34, 1], [-30, 1], [-16, 0]], blur: 1, opacity: 1, onFill: true },
    { fade: [[-48, 1], [-34, 0]], blur: 0, opacity: 1, onFill: true },
  ] as readonly NameLayer[],
  /** The row's insets and spacing (WorkingScreen.swift `WorkingRow`). */
  leading: 16,
  trailing: 8,
  spacing: 12,
  percentMinWidth: 32,
} as const;
