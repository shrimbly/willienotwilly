// Edit Video's Stacked timeline, ported from Node Banana (src/lib/stitch/placement.ts, stack.ts, moveDrag.ts,
// rulerTicks.ts, timecode.ts, speedScale.ts, warp.ts, overlays.ts and src/lib/easing). Pure: no React, no DOM.
// Rows are layers: row 0 is in front. Times are seconds.

export const FRAME_RATE = 60;
export const SLOT_SEC = 1 / FRAME_RATE;
export const TIME_EPS = 1e-9;
export const DEFAULT_OVERLAP_SEC = 1;
/** The demo keeps every start inside the first minute, so Fit never shrinks the clips to slivers. */
export const MAX_START_SEC = 40;
export const SNAP_THRESHOLD_PX = 8;
export const ROW_HYSTERESIS_PX = 4;
export const MIN_CLIP_SEC = 0.1;

// ---------- The edit ----------

export type EaseName = keyof typeof EASINGS;
export type BezierHandles = [number, number, number, number];
export type RampCurve =
  | { kind: "preset"; name: EaseName }
  | { kind: "bezier"; handles: BezierHandles }
  | { kind: "points"; points: Array<[number, number]> };
export type RampMode = "none" | RampCurve["kind"];

export interface SourceMedia {
  id: string;
  name: string;
  src: string;
  poster: string;
  /** Eight frames side by side, STRIP_TILE (160×90) each. */
  strip: string;
  duration: number;
}

export interface EvClip {
  id: string;
  source: string;
  inSec: number;
  outSec: number;
  start: number;
  /** The average speed: the clip lasts (out − in) / speed on the timeline. */
  speed: number;
  ramp: RampCurve | null;
  muted: boolean;
  volume: number;
}

export interface EvText {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  weight: number;
  wash: number;
}

export interface EvAudio {
  id: string;
  name: string;
  startSec: number;
  inSec: number;
  outSec: number;
  duration: number;
  muted: boolean;
  volume: number;
  fade: { in: boolean; out: boolean };
}

export interface EvEdit {
  /** Row order: clips[0] is row 0, in front. */
  clips: EvClip[];
  texts: EvText[];
  audio: EvAudio;
  crossfade: boolean;
  mode: "stacked" | "track";
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const clamp01 = (value: number) => (Number.isNaN(value) ? 0 : clamp(value, 0, 1));
const underSlot = (sec: number) => sec < SLOT_SEC - TIME_EPS;

export const clipLength = (c: Pick<EvClip, "inSec" | "outSec" | "speed">) => (c.outSec - c.inSec) / c.speed;
export const clipEnd = (c: EvClip) => c.start + clipLength(c);
export const audioLength = (a: EvAudio) => a.outSec - a.inSec;
export const clipName = (row: number) => `Clip ${row + 1}`;

/** Where each clip plays: Stacked keeps its own start; Track lays the rows end to end. */
export function placedClips(edit: Pick<EvEdit, "clips" | "mode">): EvClip[] {
  if (edit.mode === "stacked") return edit.clips;
  let at = 0;
  return edit.clips.map((c) => {
    const placed = { ...c, start: at };
    at += clipLength(c);
    return placed;
  });
}

export function sequenceEnd(clips: readonly EvClip[]): number {
  return clips.reduce((end, c) => Math.max(end, clipEnd(c)), 0);
}

// ---------- Ramps (src/lib/easing, src/lib/stitch/warp.ts) ----------

type Ease = (t: number) => number;

const asymmetric = (easeIn: Ease, easeOut: Ease): Ease => (t) =>
  t <= 0.5 ? 0.5 * easeIn(t * 2) : 0.5 + 0.5 * easeOut((t - 0.5) * 2);

const BASE = {
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (t - 1) ** 3 + 1,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeInQuart: (t: number) => t ** 4,
  easeOutQuart: (t: number) => 1 - (t - 1) ** 4,
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  easeInQuint: (t: number) => t ** 5,
  easeOutQuint: (t: number) => 1 + (t - 1) ** 5,
  easeInOutQuint: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInExpo: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t ** 2),
  easeOutCirc: (t: number) => Math.sqrt(1 - (t - 1) ** 2),
  easeInOutCirc: (t: number) =>
    t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
};

export const EASINGS = {
  ...BASE,
  easeInExpoOutCubic: asymmetric(BASE.easeInExpo, BASE.easeOutCubic),
  easeInQuartOutQuad: asymmetric(BASE.easeInQuart, BASE.easeOutQuad),
};

export const DEFAULT_RAMP: EaseName = "easeInOutSine";

const BEZIERS: Partial<Record<EaseName, BezierHandles>> = {
  easeInExpoOutCubic: [0.85, 0, 0.15, 1],
  easeInOutExpo: [0.87, 0, 0.13, 1],
  easeInQuartOutQuad: [0.8, 0, 0.2, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInQuad: [0.11, 0, 0.5, 0],
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInQuart: [0.5, 0, 0.75, 0],
  easeOutQuart: [0.25, 1, 0.5, 1],
  easeInOutQuart: [0.76, 0, 0.24, 1],
  easeInQuint: [0.64, 0, 0.78, 0],
  easeOutQuint: [0.22, 1, 0.36, 1],
  easeInOutQuint: [0.83, 0, 0.17, 1],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeInCirc: [0.55, 0, 1, 0.45],
  easeOutCirc: [0, 0.55, 0.45, 1],
  easeInOutCirc: [0.85, 0, 0.15, 1],
};
const DEFAULT_CUSTOM_BEZIER: BezierHandles = [0.42, 0, 0.58, 1];

const SIDES: Record<string, string> = { In: "in", Out: "out", InOut: "in-out" };

/** "Ease in-out sine", "Ease in expo, out cubic". */
export function easingLabel(name: string): string {
  const named = /^ease(InOut|In|Out)(Quad|Cubic|Quart|Quint|Sine|Expo|Circ)$/.exec(name);
  if (named) return `Ease ${SIDES[named[1]]} ${named[2].toLowerCase()}`;
  const hybrid = /^easeIn(\w+?)Out(\w+)$/.exec(name);
  if (hybrid) return `Ease in ${hybrid[1].toLowerCase()}, out ${hybrid[2].toLowerCase()}`;
  return name;
}

/** CSS cubic-bezier(x1, y1, x2, y2) as y(x), solved by Newton then bisection. */
function bezierEase([x1, y1, x2, y2]: BezierHandles): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** A monotone cubic through the knots (Fritsch–Carlson), as the drawn Points ramp. */
function pointsEase(points: ReadonlyArray<readonly [number, number]>): Ease {
  const n = points.length;
  if (n < 2) return (t) => t;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const u = (t - xs[i]) / h;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

const IDENTITY: Ease = (t) => t;

export function rampEase(ramp: RampCurve | null): Ease {
  if (!ramp) return IDENTITY;
  if (ramp.kind === "preset") return EASINGS[ramp.name] ?? IDENTITY;
  if (ramp.kind === "bezier") return bezierEase(ramp.handles);
  return pointsEase(ramp.points);
}

export const rampModeOf = (ramp: RampCurve | null): RampMode => (ramp ? ramp.kind : "none");

/** A switch of mode seeds the new ramp from the one there is (rampModes.ts seedRamp). */
export function seedRamp(mode: RampMode, ramp: RampCurve | null): RampCurve | null {
  switch (mode) {
    case "none":
      return null;
    case "preset":
      return { kind: "preset", name: ramp?.kind === "preset" ? ramp.name : DEFAULT_RAMP };
    case "bezier":
      if (ramp?.kind === "bezier") return ramp;
      return {
        kind: "bezier",
        handles: [...((ramp?.kind === "preset" && BEZIERS[ramp.name]) || DEFAULT_CUSTOM_BEZIER)] as BezierHandles,
      };
    case "points": {
      if (ramp?.kind === "points") return ramp;
      const ease = rampEase(ramp ?? { kind: "preset", name: DEFAULT_RAMP });
      const knots = [0, 0.2, 0.4, 0.6, 0.8, 1];
      return { kind: "points", points: knots.map((p): [number, number] => [p, Number(ease(p).toFixed(4))]) };
    }
  }
}

/** SVG polyline points for an easing's thumbnail: y = (1 − f(t)) · height. */
export function easingPolyline(ease: Ease, width: number, height: number, samples = 20): string {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return `${(t * width).toFixed(1)},${((1 - ease(t)) * height).toFixed(1)}`;
  }).join(" ");
}

/** The source second a clip shows at sequence time t: a ramp bunches and spreads its frames. */
export function sourceTimeAt(c: EvClip, t: number): number {
  const length = clipLength(c);
  const p = length > 0 ? clamp01((t - c.start) / length) : 0;
  return c.inSec + rampEase(c.ramp)(p) * (c.outSec - c.inSec);
}

/** The clip's momentary playback rate at t: its speed, times the ramp's slope. */
export function rateAt(c: EvClip, t: number): number {
  if (!c.ramp) return c.speed;
  const length = clipLength(c);
  const p = length > 0 ? clamp01((t - c.start) / length) : 0;
  const ease = rampEase(c.ramp);
  const h = 0.01;
  const a = clamp01(p - h);
  const b = clamp01(p + h);
  return c.speed * ((ease(b) - ease(a)) / Math.max(1e-6, b - a));
}

// ---------- Speed (speedScale.ts, warp.ts) ----------

export const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4] as const;
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 10;

export const speedToSlider = (speed: number) => clamp(50 + 50 * Math.log10(speed), 0, 100);
const PRESET_POSITIONS = SPEED_PRESETS.map((speed) => ({ speed, pos: speedToSlider(speed) }));

export function sliderToSpeed(pos: number): number {
  const at = clamp(pos, 0, 100);
  const preset = PRESET_POSITIONS.find((p) => Math.abs(p.pos - at) <= 0.5);
  if (preset) return preset.speed;
  return Number((10 ** ((at - 50) / 50)).toPrecision(3));
}

export function nudgeSpeed(speed: number, dir: 1 | -1, big: boolean): number {
  const n = big ? 10 : 1;
  let at = dir > 0 ? Math.floor(speedToSlider(speed) + 1e-9) + n : Math.ceil(speedToSlider(speed) - 1e-9) - n;
  let next = sliderToSpeed(at);
  while ((dir > 0 ? next <= speed : next >= speed) && at > 0 && at < 100) {
    at += dir;
    next = sliderToSpeed(at);
  }
  return next;
}

/** "2×", "0.5×", "1.05×". */
export function formatSpeed(speed: number): string {
  if (!(speed >= 0.0005)) return speed > 0 ? "< 0.001×" : "0×";
  return `${Number(speed.toPrecision(3))}×`;
}

export function parseSpeed(text: string): number | null {
  const m = /^(\d+(?:[.,]\d*)?|[.,]\d+)\s*[x×]?$/i.exec(text.trim());
  const value = m ? Number(m[1].replace(",", ".")) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The timeline badge: "2×", "Ramp", or nothing at the clip's own speed. */
export function rateLabel(c: EvClip): string | null {
  if (c.ramp) return "Ramp";
  return c.speed !== 1 ? formatSpeed(c.speed) : null;
}

// ---------- Timecode (timecode.ts) ----------

const MINUS = "−";

/** m:ss with `digits` decimals, rounded once on the total. */
export function formatTimecode(sec: number, digits: 0 | 1 | 2 = 2): string {
  const scale = 10 ** digits;
  const units = Math.round((Number.isFinite(sec) ? Math.max(0, sec) : 0) * scale);
  const minutes = Math.floor(units / (60 * scale));
  const rest = units - minutes * 60 * scale;
  const seconds = String(Math.floor(rest / scale)).padStart(2, "0");
  const fraction = digits > 0 ? `.${String(rest % scale).padStart(digits, "0")}` : "";
  return `${minutes}:${seconds}${fraction}`;
}

/** "4.20 s"; signed "−0.80 s" / "+0.80 s". */
export function formatSeconds(sec: number, digits: 1 | 2 = 2, opts: { signed?: boolean } = {}): string {
  const value = Number.isFinite(sec) ? sec : 0;
  const text = Math.abs(value).toFixed(digits);
  const sign = Number(text) === 0 ? "" : value < 0 ? MINUS : opts.signed ? "+" : "";
  return `${sign}${text} s`;
}

/** "4.6", "0:04.6", "1:02.30". */
export function parseTimecode(text: string): number | null {
  const value = text.trim().replace(",", ".").replace(/\s*(s|sec|secs|seconds)\.?$/i, "");
  const plain = /^(\d+(?:\.\d*)?|\.\d+)$/.exec(value);
  if (plain) return Number(plain[1]);
  const timed = /^(\d+):(\d{1,2}(?:\.\d*)?)$/.exec(value);
  if (!timed) return null;
  const seconds = Number(timed[2]);
  return seconds >= 60 ? null : Number(timed[1]) * 60 + seconds;
}

// ---------- Ruler (rulerTicks.ts) ----------

const STEPS = [0.25, 0.5, 1, 2, 5, 10, 30, 60] as const;

export function rulerTicks(pxPerSec: number, fromSec: number, toSec: number) {
  const majors: number[] = [];
  const minors: number[] = [];
  const labels: Array<{ t: number; text: string }> = [];
  if (!(pxPerSec > 0) || toSec < fromSec) return { majors, minors, labels };
  const step = STEPS.find((s) => s * pxPerSec >= (s < 1 ? 100 : 56)) ?? 60;
  const every = step * pxPerSec >= 100 ? step : step * 2;
  const digits: 0 | 1 | 2 = step < 0.5 ? 2 : pxPerSec >= 100 || step < 1 ? 1 : 0;
  const eps = 1e-6;
  const inRange = (t: number) => t >= fromSec - eps && t <= toSec + eps;
  const first = Math.max(0, Math.floor(fromSec / every - eps));
  const last = Math.ceil(toSec / every + eps);
  for (let i = first; i <= last; i++) {
    const t = i * every;
    if (inRange(t)) {
      majors.push(t);
      labels.push({ t, text: formatTimecode(t, digits) });
    }
    if (inRange(t + every / 2)) minors.push(t + every / 2);
  }
  return { majors, minors, labels };
}

// ---------- Overlaps (stack.ts) ----------

const floorToSlot = (sec: number) => (!(sec > 0) ? 0 : Math.floor(sec * FRAME_RATE + 1e-9) / FRAME_RATE);

/** joinOverlaps for one join of two different videos: at most half of either clip. */
export function pairOverlap(a: number, b: number, overlapSec: number): number {
  if (!(a > 0 && b > 0)) return 0;
  return floorToSlot(Math.min(overlapSec, a / 2, b / 2));
}

/** Line up: each clip starts its overlap before the latest end above it (resolveStarts with no stored start). */
export function lineUp(clips: readonly EvClip[], overlapSec = DEFAULT_OVERLAP_SEC): EvClip[] {
  let latestEnd = 0;
  let previous = 0;
  return clips.map((c, i) => {
    const length = clipLength(c);
    const overlap = i === 0 ? 0 : pairOverlap(previous, length, overlapSec);
    const start = clamp(latestEnd - overlap, 0, MAX_START_SEC);
    if (length > 0) {
      latestEnd = Math.max(latestEnd, start + length);
      previous = length;
    }
    return Math.abs(start - c.start) < TIME_EPS ? c : { ...c, start };
  });
}

export const isLinedUp = (clips: readonly EvClip[]) => lineUp(clips).every((c, i) => c === clips[i]);

// ---------- The picture (placement.ts) ----------

export interface Unit {
  start: number;
  length: number;
  row: number;
}

export interface Envelope {
  /** Non-empty units in row order: every unit index here indexes this array. */
  units: Unit[];
  /** units[k] → the edit's row. */
  fades: Array<{ fadeIn: number; fadeOut: number }>;
  below: Array<Array<[number, number]>>;
  crossfade: boolean;
  breakpoints: number[];
  loopLength: number;
}

const isLive = (start: number, end: number, t: number) => start - TIME_EPS <= t && t < end - TIME_EPS;

function unionBridged(intervals: Array<[number, number]>): Array<[number, number]> {
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const parts: Array<[number, number]> = [];
  for (const [from, to] of sorted) {
    const last = parts[parts.length - 1];
    if (last && underSlot(from - last[1])) {
      last[1] = Math.max(last[1], to);
      continue;
    }
    parts.push([from, to]);
  }
  return parts;
}

/** A clip's fades against the picture below it: in over the overlap at its start, out over the one at its end. */
function runFades(s: number, e: number, below: Array<[number, number]>) {
  let fadeIn = 0;
  let fadeOut = 0;
  for (const [p, q] of below) {
    if (isLive(p, q, s)) fadeIn = Math.max(fadeIn, Math.min(Math.min(q, e) - s, s - p));
    if (p < e - TIME_EPS && q > e + TIME_EPS) fadeOut = Math.max(fadeOut, Math.min(e - Math.max(p, s), q - e));
  }
  if (underSlot(fadeIn)) fadeIn = 0;
  if (underSlot(fadeOut)) fadeOut = 0;
  const length = e - s;
  if (fadeIn + fadeOut > length + TIME_EPS) {
    const scaledIn = (length * fadeIn) / (fadeIn + fadeOut);
    fadeIn = scaledIn;
    fadeOut = length - scaledIn;
    if (underSlot(fadeIn)) {
      fadeIn = 0;
      fadeOut = underSlot(length) ? 0 : length;
    } else if (underSlot(fadeOut)) {
      fadeOut = 0;
      fadeIn = length;
    }
  }
  return { fadeIn, fadeOut };
}

export function buildEnvelope(units: readonly Unit[], crossfade: boolean): Envelope {
  const sorted = units.filter((u) => u.length > 0).sort((a, b) => a.row - b.row);
  const below = sorted.map((): Array<[number, number]> => []);
  const fades = sorted.map(() => ({ fadeIn: 0, fadeOut: 0 }));
  if (crossfade) {
    sorted.forEach((u, k) => {
      below[k] = unionBridged(sorted.slice(k + 1).map((r): [number, number] => [r.start, r.start + r.length]));
      fades[k] = runFades(u.start, u.start + u.length, below[k]);
    });
  }
  const loopLength = sorted.reduce((end, u) => Math.max(end, u.start + u.length), 0);
  const raw = [0, loopLength];
  sorted.forEach((u, k) => raw.push(u.start, u.start + u.length, u.start + fades[k].fadeIn, u.start + u.length - fades[k].fadeOut));
  raw.sort((a, b) => a - b);
  const breakpoints: number[] = [];
  for (const t of raw) if (breakpoints.length === 0 || t - breakpoints[breakpoints.length - 1] > TIME_EPS) breakpoints.push(t);
  return { units: sorted, fades, below, crossfade, breakpoints, loopLength };
}

function unitAlpha(env: Envelope, k: number, t: number): number {
  const u = env.units[k];
  if (!isLive(u.start, u.start + u.length, t)) return 0;
  const { fadeIn, fadeOut } = env.fades[k];
  let alpha = 1;
  if (fadeIn > 0) alpha = Math.min(alpha, (t - u.start) / fadeIn);
  if (fadeOut > 0) alpha = Math.min(alpha, (u.start + u.length - t) / fadeOut);
  return clamp01(alpha);
}

export interface EnvelopeLayer {
  unit: number;
  alpha: number;
  weight: number;
}

/**
 * One layer per live clip at t, bottom (the highest row) first, with its opacity and share of the picture. Crossfade
 * off: the top live clip covers (weight 1) and the rest are hidden under it.
 */
export function envelopeAt(env: Envelope, t: number): EnvelopeLayer[] {
  const live: number[] = [];
  env.units.forEach((u, i) => {
    if (isLive(u.start, u.start + u.length, t)) live.push(i);
  });
  if (!env.crossfade) {
    return live.map((unit, i) => ({ unit, alpha: i === 0 ? 1 : 0, weight: i === 0 ? 1 : 0 })).reverse();
  }
  const layers: EnvelopeLayer[] = [];
  let rest = 1;
  live.forEach((unit, i) => {
    const alpha = i === live.length - 1 ? 1 : unitAlpha(env, unit, t);
    layers.push({ unit, alpha, weight: alpha * rest });
    rest *= 1 - alpha;
  });
  return layers.reverse();
}

/** CSS opacities for weights in paint order, bottom first: α_k = w_k / Σ_{i<=k} w_i. */
export function domOpacities(weights: readonly number[]): number[] {
  let sum = 0;
  return weights.map((w) => {
    sum += w;
    return sum > 0 ? clamp01(w / sum) : 0;
  });
}

/** Stretches inside the sequence where nothing plays, at least a slot long. */
export function gapsOf(env: Envelope): Array<{ fromSec: number; toSec: number }> {
  const out: Array<{ fromSec: number; toSec: number }> = [];
  const intervals = env.units.map((u) => [u.start, u.start + u.length] as const).sort((a, b) => a[0] - b[0]);
  let covered = 0;
  for (const [from, to] of intervals) {
    if (from > covered && !underSlot(from - covered)) out.push({ fromSec: covered, toSec: from });
    covered = Math.max(covered, to);
  }
  return out;
}

/** How a clip is drawn over its own span, in its own seconds: the LayerMarks. */
export type WeightPiece =
  | { kind: "ramp"; fromSec: number; toSec: number; from: number; to: number }
  | { kind: "curve"; fromSec: number; toSec: number; points: Array<[number, number]> }
  | { kind: "hidden"; fromSec: number; toSec: number; coveredByRow: number };

interface LinearAlpha {
  at: number;
  slope: number;
}

const alphaAt = (a: LinearAlpha, fromSec: number, t: number) => clamp01(a.at + a.slope * (t - fromSec));

function linearAlpha(env: Envelope, k: number, mid: number, fromSec: number): LinearAlpha {
  const u = env.units[k];
  const { fadeIn, fadeOut } = env.fades[k];
  let value = 1;
  let slope = 0;
  if (fadeIn > 0 && (mid - u.start) / fadeIn < value) {
    value = (mid - u.start) / fadeIn;
    slope = 1 / fadeIn;
  }
  if (fadeOut > 0 && (u.start + u.length - mid) / fadeOut < value) {
    value = (u.start + u.length - mid) / fadeOut;
    slope = -1 / fadeOut;
  }
  return { at: value - slope * (mid - fromSec), slope };
}

interface Factors {
  own: LinearAlpha;
  above: LinearAlpha[];
  aboveRows: Array<{ row: number; opaque: boolean }>;
}

function factorsOver(env: Envelope, unit: number, fromSec: number, toSec: number): Factors | { coverRow: number } | null {
  const mid = (fromSec + toSec) / 2;
  const live: number[] = [];
  env.units.forEach((u, i) => {
    if (isLive(u.start, u.start + u.length, mid)) live.push(i);
  });
  if (!env.crossfade) {
    const top = live[0] ?? -1;
    if (top === unit) return { own: { at: 1, slope: 0 }, above: [], aboveRows: [] };
    return top === -1 ? null : { coverRow: env.units[top].row };
  }
  const index = live.indexOf(unit);
  if (index === -1) return live.length > 0 ? { coverRow: env.units[live[0]].row } : null;
  const alphaOf = (k: number, i: number): LinearAlpha =>
    i === live.length - 1 ? { at: 1, slope: 0 } : linearAlpha(env, k, mid, fromSec);
  const above = live.slice(0, index).map(alphaOf);
  return {
    own: alphaOf(unit, index),
    above,
    aboveRows: live.slice(0, index).map((k, i) => ({
      row: env.units[k].row,
      opaque: above[i].slope === 0 && above[i].at >= 1 - TIME_EPS,
    })),
  };
}

const weightOf = (f: Factors, fromSec: number, t: number) =>
  f.above.reduce((w, a) => w * (1 - alphaAt(a, fromSec, t)), alphaAt(f.own, fromSec, t));
const varying = (f: Factors) => (f.own.slope !== 0 ? 1 : 0) + f.above.filter((a) => a.slope !== 0).length;
const NEAR = 1e-12;

function weightOver(env: Envelope, unit: number, a: number, b: number, pxPerSec: number): WeightPiece | null {
  const f = factorsOver(env, unit, a, b);
  if (f === null) return { kind: "hidden", fromSec: a, toSec: b, coveredByRow: env.units[unit].row };
  if ("coverRow" in f) return { kind: "hidden", fromSec: a, toSec: b, coveredByRow: f.coverRow };
  const ends = [weightOf(f, a, a), weightOf(f, a, (a + b) / 2), weightOf(f, a, b)];
  if (ends.every((w) => w <= NEAR)) {
    let cover = f.aboveRows[0]?.row ?? env.units[unit].row;
    for (let i = f.aboveRows.length - 1; i >= 0; i--) {
      if (f.aboveRows[i].opaque) {
        cover = f.aboveRows[i].row;
        break;
      }
    }
    return { kind: "hidden", fromSec: a, toSec: b, coveredByRow: cover };
  }
  if (ends.every((w) => w >= 1 - NEAR)) return null;
  if (varying(f) <= 1) return { kind: "ramp", fromSec: a, toSec: b, from: ends[0], to: ends[2] };
  const count = Math.max(2, Math.min(17, Math.ceil(((b - a) * pxPerSec) / 4) + 1));
  const points: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const t = a + ((b - a) * i) / (count - 1);
    points.push([t, weightOf(f, a, t)]);
  }
  return { kind: "curve", fromSec: a, toSec: b, points };
}

/** A clip's share of the picture over its own span, in its own seconds from its start. */
export function weightPieces(env: Envelope, unit: number, pxPerSec = 64): WeightPiece[] {
  const u = env.units[unit];
  if (!u) return [];
  const cuts = [u.start, ...env.breakpoints.filter((b) => b > u.start + TIME_EPS && b < u.start + u.length - TIME_EPS), u.start + u.length];
  const pieces: WeightPiece[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    if (b - a <= TIME_EPS) continue;
    const piece = weightOver(env, unit, a, b, pxPerSec);
    if (!piece) continue;
    const last = pieces[pieces.length - 1];
    if (piece.kind === "hidden" && last?.kind === "hidden" && last.coveredByRow === piece.coveredByRow) {
      last.toSec = piece.toSec;
      continue;
    }
    pieces.push(piece);
  }
  return pieces.map((piece) => {
    const own = { fromSec: piece.fromSec - u.start, toSec: piece.toSec - u.start };
    if (piece.kind !== "curve") return { ...piece, ...own };
    return { ...piece, ...own, points: piece.points.map(([t, w]): [number, number] => [t - u.start, w]) };
  });
}

// ---------- The body drag (moveDrag.ts) ----------

export interface MoveTarget {
  t: number;
  kind: "playhead" | "edge";
  label: string;
  edge: "start" | "end" | "both";
  /** The row of the clip it belongs to; null for the playhead and 0:00. */
  row: number | null;
}

export const WHERE_IT_WAS = "where it was";

export function moveTargets(clips: readonly EvClip[], index: number, playhead: number, overlapSec = DEFAULT_OVERLAP_SEC): MoveTarget[] {
  const self = clips[index];
  if (!self) return [];
  const targets: MoveTarget[] = [
    { t: playhead, kind: "playhead", label: "the playhead", edge: "both", row: null },
    { t: 0, kind: "edge", label: "the start", edge: "start", row: null },
    { t: self.start, kind: "edge", label: WHERE_IT_WAS, edge: "start", row: index },
  ];
  clips.forEach((other, row) => {
    if (row === index) return;
    const length = clipLength(other);
    if (!(length > 0)) return;
    const name = clipName(row);
    targets.push(
      { t: other.start, kind: "edge", label: `${name}'s start`, edge: "both", row },
      { t: other.start + length, kind: "edge", label: `${name}'s end`, edge: "both", row },
    );
    const overlap = pairOverlap(length, clipLength(self), overlapSec);
    if (overlap > 0) {
      const amount = formatSeconds(overlap, Math.abs(overlap - overlapSec) < 1e-9 ? 1 : 2);
      targets.push({ t: other.start + length - overlap, kind: "edge", label: `a ${amount} overlap with ${name}`, edge: "start", row });
    }
  });
  return targets;
}

export interface MoveResult {
  startSec: number;
  deltaSec: number;
  snapped: MoveTarget | null;
  snappedEdge: "start" | "end" | null;
}

function tieRank(target: MoveTarget, edge: "start" | "end"): number {
  if (target.label === WHERE_IT_WAS) return 0;
  if (target.kind === "playhead") return 1;
  return edge === "start" ? 2 : 3;
}

/** The start a body drag lands on: the raw start, or the nearest target within 8px. */
export function moveDragAt(
  start: { startSec: number; lengthSec: number; pxPerSec: number; targets: readonly MoveTarget[] },
  dxPx: number,
  snap: boolean,
): MoveResult {
  const pps = start.pxPerSec > 0 ? start.pxPerSec : 1;
  const raw = start.startSec + dxPx / pps;
  let best: { target: MoveTarget; edge: "start" | "end"; value: number; distance: number } | null = null;
  if (snap) {
    const threshold = SNAP_THRESHOLD_PX / pps;
    for (const target of start.targets) {
      const edges: Array<"start" | "end"> = target.edge === "both" ? ["start", "end"] : [target.edge];
      for (const edge of edges) {
        const value = edge === "start" ? target.t : target.t - start.lengthSec;
        if (!Number.isFinite(value) || value < -TIME_EPS || value > MAX_START_SEC) continue;
        const distance = Math.abs(value - raw);
        if (distance > threshold) continue;
        const better =
          !best ||
          distance < best.distance - TIME_EPS ||
          (distance <= best.distance + TIME_EPS && tieRank(target, edge) < tieRank(best.target, best.edge));
        if (better) best = { target, edge, value, distance };
      }
    }
  }
  const startSec = clamp(best ? best.value : raw, 0, MAX_START_SEC);
  const held = best !== null && Math.abs(startSec - best.value) <= TIME_EPS;
  return {
    startSec,
    deltaSec: startSec - start.startSec,
    snapped: held && best ? best.target : null,
    snappedEdge: held && best ? best.edge : null,
  };
}

export function moveSnapText(result: MoveResult): string | null {
  if (!result.snapped) return null;
  return result.snappedEdge === "end" ? `End snapped to ${result.snapped.label}` : `Snapped to ${result.snapped.label}`;
}

/** The row a body drag lands in: the pressed row's centre plus dy, kept until it passes half a row and 4px. */
export function moveRowAt(index: number, dy: number, current: number, rowCount: number, rowPx: number): number {
  const last = Math.max(0, rowCount - 1);
  const kept = clamp(current, 0, last);
  const centre = (index + 0.5) * rowPx + dy;
  const top = kept * rowPx;
  if (centre >= top - ROW_HYSTERESIS_PX && centre <= top + rowPx + ROW_HYSTERESIS_PX) return kept;
  return clamp(Math.floor(centre / rowPx), 0, last);
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------- Text layers (overlays.ts) ----------

export function overlayOpacityAt(o: Pick<EvText, "startSec" | "endSec" | "fadeInSec" | "fadeOutSec">, t: number): number {
  if (!(t >= o.startSec && t < o.endSec)) return 0;
  const rise = o.fadeInSec > 0 ? (t - o.startSec) / o.fadeInSec : 1;
  const fall = o.fadeOutSec > 0 ? (o.endSec - t) / o.fadeOutSec : 1;
  return clamp(Math.min(rise, fall), 0, 1);
}

export function overlayFadeKnees(o: Pick<EvText, "startSec" | "endSec" | "fadeInSec" | "fadeOutSec">) {
  const length = o.endSec - o.startSec;
  const fades = o.fadeInSec + o.fadeOutSec;
  if (fades <= length) return { fadeInEnd: o.startSec + o.fadeInSec, fadeOutStart: o.endSec - o.fadeOutSec, peak: 1 };
  const at = (o.endSec * o.fadeInSec + o.startSec * o.fadeOutSec) / fades;
  return { fadeInEnd: at, fadeOutStart: at, peak: length / fades };
}

export const overlayFirstLine = (text: string) => text.split("\n").find((line) => line.trim() !== "")?.trim() ?? null;

// ---------- Waveform (peaks.ts) ----------

/** The loudest peak in [from, to) source seconds of a track with peaks.length bins over duration. */
export function peakInRange(peaks: readonly number[], duration: number, from: number, to: number): number {
  if (!(duration > 0) || peaks.length === 0) return 0;
  const per = duration / peaks.length;
  const a = clamp(Math.floor(from / per), 0, peaks.length - 1);
  const b = clamp(Math.ceil(to / per) - 1, a, peaks.length - 1);
  let max = 0;
  for (let i = a; i <= b; i++) max = Math.max(max, peaks[i]);
  return from >= duration || to <= 0 ? 0 : max;
}
