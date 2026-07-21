// Shared contract for the Life Clock lab experiment.
// This file is the boundary between the pure layout engine (layout.ts), the
// three.js renderer (renderer.ts), the zoom state machine (zoom.ts), and the
// DOM overlay (hud.tsx / calibration.tsx). Keep it dependency-free.

export type ViewIndex = 0 | 1 | 2 | 3;

export const VIEW_DAY = 0 as ViewIndex;
export const VIEW_WEEK = 1 as ViewIndex;
export const VIEW_YEAR = 2 as ViewIndex;
export const VIEW_LIFE = 3 as ViewIndex;

export const VIEW_NAMES = ["DAY", "WEEK", "YEAR", "LIFE"] as const;
export const VIEW_LABELS = [
  "Day view",
  "Week view",
  "Year view",
  "Life view",
] as const;

/** Axis-aligned rect in layout px (CSS px, y-down, origin at viewport top-left). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Per-frame live position inside a view's grid.
 * `index` is the time-order index of the live cell among the view's REAL
 * (instanced) cells; `frac` is the left→right wipe fraction inside it;
 * `filled` is the count of cells strictly before it (all fully filled).
 */
export interface LiveState {
  index: number;
  frac: number;
  filled: number;
}

export interface AxisTick {
  /** Position of the tick in layout px (x for top-axis ticks, y for left-axis). */
  pos: number;
  /** Label text; empty string = unlabeled minor tick. */
  label: string;
  major: boolean;
}

export interface AxisSpec {
  /** Ticks along the left gutter (horizontal graduations: hours, ages…). */
  left: AxisTick[];
  /** Ticks along the top gutter (vertical graduations: weekdays, months…). */
  top: AxisTick[];
  /** Index into `left`/`top` of the tick nearest the live cell, or -1. */
  activeLeft: number;
  activeTop: number;
}

/**
 * A fully built at-rest grid layout for one view at one viewport size.
 * Built by layout.ts; consumed by renderer.ts (instance buffers) and
 * life-clock.tsx (slot hit-testing, axis DOM).
 */
export interface ViewLayout {
  view: ViewIndex;
  /** Outer bounding rect of the whole grid (all cells incl. gutters). */
  gridRect: Rect;
  /** Packed cell rects, 4 floats per cell (x, y, w, h), time-order. */
  cells: Float32Array;
  cellCount: number;
  /** Cell pitch (w/h of one cell in layout px) — for gap derivation. */
  cellW: number;
  cellH: number;
  /**
   * Rect of the child slot containing "now" (today's band in WEEK, this
   * week's run in YEAR, this year's row segment in LIFE). null for DAY.
   * Computed at build time; rebuild the layout on day rollover.
   */
  slotRect: Rect | null;
  /** O(1) per-frame live position (no allocation beyond the return object). */
  liveState(now: Date): LiveState;
  /** Rect of one cell by time-order index (reads from `cells`). */
  cellRect(index: number): Rect;
  /**
   * Exact instanced-cell index for a date, or -1 if its cell is not on the
   * grid. LIFE only (event marker placement); unlike liveState it never
   * clamps. Absent on other views.
   */
  cellIndexForDate?(date: Date): number;
  /** Axis graduations for the DOM axis layer. */
  axis: AxisSpec;
  /**
   * Active graduation indices for `now` — O(1), recomputed by the caller
   * whenever the highlight may have moved (hourly for DAY, daily otherwise).
   */
  activeAxis(now: Date): { left: number; top: number };
  /**
   * LIFE view only: time-order index of the expectancy week cell (for the
   * end-of-range marker), else -1.
   */
  expectancyIndex: number;
}

/**
 * Maps layout px to screen px for one instanced layer:
 * screenX = offsetX + scaleX * layoutX (same for y).
 */
export interface LayerTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export const IDENTITY_TRANSFORM: LayerTransform = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
};

/**
 * Everything the renderer needs to draw one frame of a morph (or an at-rest
 * frame, where parent is null and child transform is identity).
 * Produced by life-clock.tsx from zoom state + layout math each frame.
 */
export interface MorphFrame {
  child: {
    transform: LayerTransform;
    opacity: number;
    live: LiveState;
  } | null;
  parent: {
    transform: LayerTransform;
    opacity: number;
    /** Opacity of the parent's own cells INSIDE the slot (resolution crossfade). */
    slotInteriorOpacity: number;
    live: LiveState;
  } | null;
  /** 0..1 opacity of the slot outline stroke on the parent layer. */
  slotOutlineOpacity: number;
  /** Pulse alpha for the live cell + record dot, already waveform-evaluated. */
  pulseAlpha: number;
  /** Seconds since the last cell commit, for the 300ms commit flash. -1 = none. */
  commitAge: number;
  /** Uniform extra scale applied to the whole scene (rubber-band lean). */
  rubberScale: number;
  reducedMotion: boolean;
  /** Life-event markers + hover state; null outside the LIFE view. */
  events: EventFrame | null;
  /** 0..1 eased strength of the PLACES overlay (life-location bands). */
  placesAmount: number;
}

/**
 * A dated moment on the LIFE grid — either a recorded fact (met, married,
 * born) or a derived prediction. Produced by lib/life-events.ts.
 */
export type EventCertainty = "record" | "estimate" | "probability";

export interface ClockEvent {
  id: string;
  /** Short uppercase label, e.g. "MORE TIME TOGETHER THAN APART". */
  label: string;
  date: Date;
  /** One sentence explaining what the moment is. */
  detail: string;
  /** How it was derived — formula or source, rendered dim. */
  basis: string;
  certainty: EventCertainty;
  /** A life-forking moment — marked with the crossroad symbol. */
  crossroad?: boolean;
  /** Span the event refers to; highlighted on hover. Omit for a point event. */
  rangeStart?: Date;
  rangeEnd?: Date;
}

/** An event resolved to cell indices in the current LIFE layout. */
export interface EventMarker {
  id: string;
  /** Cell index of the event's own week; -1 if outside the grid. */
  index: number;
  /** Inclusive cell range to highlight on hover; -1/-1 for point events. */
  rangeStart: number;
  rangeEnd: number;
}

export interface EventFrame {
  markers: EventMarker[];
  /** id of the hovered marker, or null. */
  hoveredId: string | null;
  /** 0..1 eased hover strength, for the glow and range lift. */
  hoverAmount: number;
}

/**
 * Normalised payload for the hover readout — produced from either a ClockEvent
 * or a place band, so the card renders one shape. Carries its own anchor so the
 * exit fade holds the last position instead of snapping to the top-left.
 */
export interface HoverCardInfo {
  /** Stable identity; the card only re-derives its content when this changes. */
  key: string;
  /** Swatch colour (hex). */
  swatch: string;
  /** Outline swatch instead of filled (crossroads, places). */
  hollow: boolean;
  /** Category label: "RECORD" | "ESTIMATE" | "PROBABILITY" | "CROSSROAD" | "PLACE". */
  kind: string;
  /** Dim line under the kind (date + relative, or years + span). */
  dateLine: string;
  title: string;
  detail: string;
  basis: string;
  /** Anchor in layout px, relative to the clock container. */
  x: number;
  y: number;
}

/** Axis gutters (px) reserved beside the grid for DOM graduation labels. */
export const AXIS_LEFT_GUTTER = 32;
export const AXIS_TOP_GUTTER = 18;

/** Design tokens — single source of truth for both canvas and DOM. */
export const TOKENS = {
  bg: "#060707",
  cellEmpty: "#151717",
  // LIFE cells are large and the unlived remainder dominates the screen;
  // the tighter empty value would read as bare background there.
  cellEmptyOpen: "#262727",
  cellFilled: "#C9CFCC",
  hairline: "rgba(255, 255, 255, 0.09)",
  hairlineStrong: "rgba(255, 255, 255, 0.22)",
  text: "#DDE2E0",
  textDim: "#7A827F",
  textFaint: "#464B4A",
  live: "#63E2B7",
  // Event markers are monochrome: dark on lived (bright) cells, light on
  // unlived (dark) ones — the `bg`/`text` tokens above, chosen per cell.
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/**
 * The marker glyph, by the nature of the claim — matching the card's kind
 * label. A solid dot is a fact; an asterisk is an estimate; a hollow diamond
 * is a probabilistic prediction; the solid diamond flags a fork. Monochrome;
 * the ink adapts to the cell.
 */
export const EVENT_SYMBOL = {
  record: "●",
  estimate: "✱",
  probability: "◇",
  crossroad: "◆",
} as const;

export function eventSymbol(e: {
  certainty: EventCertainty;
  crossroad?: boolean;
}): string {
  return e.crossroad ? EVENT_SYMBOL.crossroad : EVENT_SYMBOL[e.certainty];
}

/** Pulse waveform: u = fractional part of the wall-clock second. */
export function pulseAlpha(u: number): number {
  return 0.35 + 0.65 * Math.exp(-5 * u);
}

/** Fields the main loop pushes into the HUD imperatively (never via props). */
export interface HudFrameFields {
  clock: string;
  modeLine: string;
  elapsed: string;
  remaining: string;
  cell: string;
  /** Continuous ladder position 0..3 (integer at rest, fractional mid-morph). */
  ladderPos: number;
  /** Record-dot opacity (pulse-driven). */
  dotAlpha: number;
  /** Nearest view for label highlighting. */
  nearestView: ViewIndex;
  /** Axis layer opacity 0..1 (fades out during morphs). */
  axisOpacity: number;
  /** Screen-space Y offset for the LIFE age axis (scroll × ease); 0 elsewhere. */
  axisScrollY: number;
}

/** Imperative handle exposed by the HUD via ref. */
export interface HudHandle {
  update(fields: Partial<HudFrameFields>): void;
  /** 120ms opacity dip on a ladder end tick — limit feedback. */
  limitDip(view: ViewIndex): void;
}

export interface ZoomCallbacks {
  /** Continuous view position changed (lean, morph progress, rest). */
  onFrame(viewPos: number, rubberScale: number): void;
  /** A committed transition started from `from` toward `to`. */
  onTransitionStart(from: ViewIndex, to: ViewIndex): void;
  /** Settled at rest on `view`. */
  onRest(view: ViewIndex): void;
  /** A discrete input tried to step past a ladder end (-1 = in, 1 = out). */
  onLimit?(dir: -1 | 1): void;
}
