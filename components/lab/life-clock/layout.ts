// Pure layout engine for the Life Clock: grid factorizations, aspect-fit,
// per-cell rects, slot rects, O(1) live state, and rect-to-rect morph math.
// No DOM, no three.js — deterministic functions of (view, gridArea, now).

import type {
  AxisTick,
  LayerTransform,
  LiveState,
  Rect,
  ViewIndex,
  ViewLayout,
} from "@/components/lab/life-clock/types";
import {
  VIEW_DAY,
  VIEW_LIFE,
  VIEW_WEEK,
  VIEW_YEAR,
} from "@/components/lab/life-clock/types";
import type { LifeProfile } from "@/lib/life-clock";
import {
  getExpectancyDate,
  isoWeek,
  isoWeekYear,
  isoWeekday,
  parseDob,
  weeksInIsoYear,
} from "@/lib/life-clock";

export const CELL_ASPECT_MIN = 0.65;
// 2.0 lets the WEEK grid (wide day-bands over tall rows) fill a 16:9 stage
// instead of letterboxing; beyond this cells stop reading as squares.
export const CELL_ASPECT_MAX = 2;

export interface BuildLayoutOptions {
  view: ViewIndex;
  /** Grid area in layout px — HUD reserves and axis gutters already removed. */
  gridArea: Rect;
  now: Date;
  /** Required for LIFE. */
  profile?: LifeProfile;
}

export function buildLayout(options: BuildLayoutOptions): ViewLayout {
  const { view, gridArea, now, profile } = options;
  const landscape = gridArea.w >= gridArea.h;
  if (view === VIEW_LIFE) {
    if (!profile) {
      throw new Error("buildLayout: LIFE view requires a profile");
    }
    // LIFE is always a single vertical scrolling column (orientation-agnostic).
    return buildLife(gridArea, now, profile);
  }
  if (view === VIEW_YEAR) return buildYear(gridArea, now, landscape);
  if (view === VIEW_WEEK) return buildWeek(gridArea, now, landscape);
  return buildDay(gridArea, now, landscape);
}

// ---------------------------------------------------------------------------
// Unit space: cells are 1×1 units; gutters are fractional units inserted after
// every `group` cells. `unitPos` is a cell's leading edge in units.

function unitPos(i: number, group: number, gutter: number): number {
  return gutter === 0 ? i : i + Math.floor(i / group) * gutter;
}

function totalUnits(n: number, group: number, gutter: number): number {
  return gutter === 0 ? n : n + (Math.ceil(n / group) - 1) * gutter;
}

interface FitResult {
  gridRect: Rect;
  cellW: number;
  cellH: number;
}

/**
 * Aspect-fit: fill both axes exactly while cellW/cellH stays inside
 * [CELL_ASPECT_MIN, CELL_ASPECT_MAX]; otherwise clamp the aspect and
 * letterbox (center) along the constrained axis. With `square`, cells are
 * forced to exact squares (cellW === cellH) and both axes letterbox as needed.
 */
function fitGrid(area: Rect, cu: number, ru: number, square = false): FitResult {
  let cellW = area.w / cu;
  let cellH = area.h / ru;
  if (square) {
    cellW = cellH = Math.min(cellW, cellH);
  } else {
    const aspect = cellW / cellH;
    if (aspect > CELL_ASPECT_MAX) {
      cellW = cellH * CELL_ASPECT_MAX;
    } else if (aspect < CELL_ASPECT_MIN) {
      cellH = cellW / CELL_ASPECT_MIN;
    }
  }
  const w = cellW * cu;
  const h = cellH * ru;
  return {
    gridRect: {
      x: area.x + (area.w - w) / 2,
      y: area.y + (area.h - h) / 2,
      w,
      h,
    },
    cellW,
    cellH,
  };
}

function wallSeconds(now: Date): number {
  return (
    now.getHours() * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds() +
    now.getMilliseconds() / 1000
  );
}

/** Monday-based weekday index, 0 = Monday … 6 = Sunday. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function makeCellRect(cells: Float32Array): (index: number) => Rect {
  return (index: number): Rect => {
    const o = index * 4;
    return { x: cells[o], y: cells[o + 1], w: cells[o + 2], h: cells[o + 3] };
  };
}

// ---------------------------------------------------------------------------
// DAY — 17,280 five-second cells. Landscape 96×180 (row = 15 min), portrait
// 144×120 (row = 10 min). Hour-band row gutter 0.5; landscape minute column
// gutter 0.25 every 12 cells.

function buildDay(area: Rect, now: Date, landscape: boolean): ViewLayout {
  const rows = landscape ? 96 : 144;
  const cols = landscape ? 180 : 120;
  const rowGroup = landscape ? 4 : 6;
  const rowGutter = 0.5;
  const colGroup = landscape ? 12 : 1;
  const colGutter = landscape ? 0.25 : 0;
  const cu = totalUnits(cols, colGroup, colGutter);
  const ru = totalUnits(rows, rowGroup, rowGutter);
  const { gridRect, cellW, cellH } = fitGrid(area, cu, ru);

  const cellCount = rows * cols;
  const cells = new Float32Array(cellCount * 4);
  for (let i = 0; i < cellCount; i++) {
    const o = i * 4;
    cells[o] = gridRect.x + unitPos(i % cols, colGroup, colGutter) * cellW;
    cells[o + 1] =
      gridRect.y + unitPos(Math.floor(i / cols), rowGroup, rowGutter) * cellH;
    cells[o + 2] = cellW;
    cells[o + 3] = cellH;
  }

  const left: AxisTick[] = [];
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    left.push({
      pos: gridRect.y + unitPos(h * rowGroup, rowGroup, rowGutter) * cellH,
      label: major ? pad2(h) : "",
      major,
    });
  }

  return {
    view: VIEW_DAY,
    gridRect,
    cells,
    cellCount,
    cellW,
    cellH,
    slotRect: null,
    liveState: (t: Date): LiveState => {
      // Wall-clock decomposition — indices stay in range on DST days.
      const index = Math.min(
        cellCount - 1,
        t.getHours() * 720 + t.getMinutes() * 12 + Math.floor(t.getSeconds() / 5),
      );
      const frac = ((t.getSeconds() % 5) + t.getMilliseconds() / 1000) / 5;
      return { index, frac, filled: index };
    },
    cellRect: makeCellRect(cells),
    axis: {
      left,
      top: [],
      activeLeft: Math.floor(now.getHours() / 6) * 6,
      activeTop: -1,
    },
    // The most recent labeled major (00/06/12/18) — labels exist only there.
    activeAxis: (t: Date) => ({
      left: Math.floor(t.getHours() / 6) * 6,
      top: -1,
    }),
    expectancyIndex: -1,
  };
}

// ---------------------------------------------------------------------------
// WEEK — 10,080 minute cells. Days are columns Mon→Sun; each day-band shares
// the DAY view's row-unit structure per orientation, so DAY↔WEEK is a pure
// horizontal compression.

function buildWeek(area: Rect, now: Date, landscape: boolean): ViewLayout {
  const bandCols = landscape ? 15 : 10;
  const rows = landscape ? 96 : 144;
  const rowGroup = landscape ? 4 : 6;
  const rowGutter = 0.5;
  const colGroup = bandCols;
  const colGutter = landscape ? 1.5 : 1;
  const cu = totalUnits(7 * bandCols, colGroup, colGutter);
  const ru = totalUnits(rows, rowGroup, rowGutter);
  const { gridRect, cellW, cellH } = fitGrid(area, cu, ru);

  const cellCount = 7 * 1440;
  const cells = new Float32Array(cellCount * 4);
  for (let i = 0; i < cellCount; i++) {
    const day = Math.floor(i / 1440);
    const minute = i % 1440;
    const col = day * bandCols + (minute % bandCols);
    const row = Math.floor(minute / bandCols);
    const o = i * 4;
    cells[o] = gridRect.x + unitPos(col, colGroup, colGutter) * cellW;
    cells[o + 1] = gridRect.y + unitPos(row, rowGroup, rowGutter) * cellH;
    cells[o + 2] = cellW;
    cells[o + 3] = cellH;
  }

  const today = mondayIndex(now);
  const slotRect: Rect = {
    x: gridRect.x + unitPos(today * bandCols, colGroup, colGutter) * cellW,
    y: gridRect.y,
    w: bandCols * cellW,
    h: gridRect.h,
  };

  const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const top: AxisTick[] = [];
  for (let d = 0; d < 7; d++) {
    top.push({
      pos:
        gridRect.x +
        unitPos(d * bandCols, colGroup, colGutter) * cellW +
        (bandCols * cellW) / 2,
      label: WEEKDAYS[d],
      major: true,
    });
  }

  return {
    view: VIEW_WEEK,
    gridRect,
    cells,
    cellCount,
    cellW,
    cellH,
    slotRect,
    liveState: (t: Date): LiveState => {
      const index = Math.min(
        cellCount - 1,
        mondayIndex(t) * 1440 + t.getHours() * 60 + t.getMinutes(),
      );
      const frac = (t.getSeconds() + t.getMilliseconds() / 1000) / 60;
      return { index, frac, filled: index };
    },
    cellRect: makeCellRect(cells),
    axis: { left: [], top, activeLeft: -1, activeTop: today },
    activeAxis: (t: Date) => ({ left: -1, top: mondayIndex(t) }),
    expectancyIndex: -1,
  };
}

// ---------------------------------------------------------------------------
// YEAR — one cell per day of the current ISO year (364–371, whole weeks).
// Landscape rows of 4 week-runs (28 cols), portrait rows of 2 (14 cols).

function buildYear(area: Rect, now: Date, landscape: boolean): ViewLayout {
  const year = isoWeekYear(now);
  const weeks = weeksInIsoYear(year);
  const runs = landscape ? 4 : 2;
  const cols = runs * 7;
  const rows = Math.ceil(weeks / runs);
  const colGroup = 7;
  const colGutter = 1;
  const rowGroup = 1;
  const rowGutter = 0.5;
  const cu = totalUnits(cols, colGroup, colGutter);
  const ru = totalUnits(rows, rowGroup, rowGutter);
  const { gridRect, cellW, cellH } = fitGrid(area, cu, ru);

  const cellCount = weeks * 7;
  const cells = new Float32Array(cellCount * 4);
  for (let i = 0; i < cellCount; i++) {
    const w = Math.floor(i / 7);
    const col = (w % runs) * 7 + (i % 7);
    const row = Math.floor(w / runs);
    const o = i * 4;
    cells[o] = gridRect.x + unitPos(col, colGroup, colGutter) * cellW;
    cells[o + 1] = gridRect.y + unitPos(row, rowGroup, rowGutter) * cellH;
    cells[o + 2] = cellW;
    cells[o + 3] = cellH;
  }

  const nowWeek = isoWeek(now) - 1;
  const slotRect: Rect = {
    x: gridRect.x + unitPos((nowWeek % runs) * 7, colGroup, colGutter) * cellW,
    y:
      gridRect.y +
      unitPos(Math.floor(nowWeek / runs), rowGroup, rowGutter) * cellH,
    w: 7 * cellW,
    h: cellH,
  };

  // Month labels go on the LEFT axis, one per row band: the grid wraps
  // `runs` weeks per row, so a linear top month axis would scramble.
  const MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const left: AxisTick[] = [];
  const rowTick = new Map<number, number>();
  const tickByMonth = new Array<number>(12).fill(-1);
  for (let m = 0; m < 12; m++) {
    // First day of the month that belongs to this ISO year (Jan 1–3 may
    // fall in the previous ISO year's trailing week).
    let day = 1;
    while (day <= 7 && isoWeekYear(new Date(year, m, day)) !== year) day++;
    if (day > 7) continue;
    const first = new Date(year, m, day);
    const row = Math.floor((isoWeek(first) - 1) / runs);
    if (!rowTick.has(row)) {
      rowTick.set(row, left.length);
      left.push({
        pos: gridRect.y + (unitPos(row, rowGroup, rowGutter) + 0.5) * cellH,
        label: MONTHS[m],
        major: true,
      });
    }
    tickByMonth[m] = rowTick.get(row)!;
  }
  const activeMonthTick = (t: Date): number => {
    // Month of the live week's Thursday — always inside this ISO year.
    const th = new Date(
      t.getFullYear(),
      t.getMonth(),
      t.getDate() + (4 - isoWeekday(t)),
    );
    return isoWeekYear(t) === year ? tickByMonth[th.getMonth()] : -1;
  };
  const activeLeft = activeMonthTick(now);

  return {
    view: VIEW_YEAR,
    gridRect,
    cells,
    cellCount,
    cellW,
    cellH,
    slotRect,
    liveState: (t: Date): LiveState => {
      const index = clampInt(
        (isoWeek(t) - 1) * 7 + (isoWeekday(t) - 1),
        0,
        cellCount - 1,
      );
      return { index, frac: wallSeconds(t) / 86_400, filled: index };
    },
    cellRect: makeCellRect(cells),
    axis: { left, top: [], activeLeft, activeTop: -1 },
    activeAxis: (t: Date) => ({ left: activeMonthTick(t), top: -1 }),
    expectancyIndex: -1,
  };
}

// ---------------------------------------------------------------------------
// LIFE — one cell per ISO week; rows are ISO years from the birth year to the
// expectancy year (extended to the current year if outlived). Ghost cells
// (before birth, after expectancy, missing week 53) are not instanced.

const LIFE_WEEKS = 52;
// Column counts a year may reflow into (divisors of 52), widest first.
const LIFE_PER_ROW = [52, 26, 13, 4, 2, 1];
const LIFE_MIN_CELL = 12; // don't wrap so hard the weeks stop reading
const LIFE_MAX_CELL = 20; // don't blow the cells up on a wide desktop
const LIFE_DECADE_GUTTER = 0.5; // half-cell gap between decades

/** Weeks-per-row: the widest wrap whose square cell still clears the min size. */
function lifePerRow(areaW: number): number {
  for (const p of LIFE_PER_ROW) {
    if (areaW / p >= LIFE_MIN_CELL) return p;
  }
  return LIFE_PER_ROW[LIFE_PER_ROW.length - 1];
}

function buildLife(area: Rect, now: Date, profile: LifeProfile): ViewLayout {
  const dob = parseDob(profile.dob, now);
  if (!dob) {
    throw new Error(`buildLayout: invalid dob in profile: "${profile.dob}"`);
  }
  const expectancy = getExpectancyDate(profile, now);
  const firstYear = isoWeekYear(dob);
  const expYear = isoWeekYear(expectancy);
  const lastYear = Math.max(expYear, isoWeekYear(now), firstYear);
  const yearCount = lastYear - firstYear + 1;

  // A single vertical column of year blocks. Each year's up-to-52 weeks reflow
  // to fit the width — one row on a wide screen, wrapped into `subRows` of
  // `perRow` on a phone — so the column never overflows sideways and scrolls
  // only vertically. The 53rd ISO week folds into the 52nd cell.
  const WEEKS = LIFE_WEEKS;
  const perRow = lifePerRow(area.w);
  const subRows = WEEKS / perRow; // exact: perRow divides 52
  const cell = Math.min(LIFE_MAX_CELL, area.w / perRow);
  const cellW = cell;
  const cellH = cell;
  const colW = perRow * cell;

  // Vertical unit of a year's first sub-row: stacked blocks + decade gutters.
  const yearBaseV = (r: number): number =>
    r * subRows + Math.floor(r / 10) * LIFE_DECADE_GUTTER;
  const totalV =
    yearCount * subRows + Math.floor((yearCount - 1) / 10) * LIFE_DECADE_GUTTER;

  const gridRect: Rect = {
    x: area.x + (area.w - colW) / 2, // centre the column; scrolling is vertical
    y: area.y,
    w: colW,
    h: totalV * cell,
  };

  const dobCol = Math.min(WEEKS - 1, isoWeek(dob) - 1);
  const expCol = Math.min(WEEKS - 1, isoWeek(expectancy) - 1);

  const rowStartCol = new Int32Array(yearCount);
  const rowEndCol = new Int32Array(yearCount);
  const rowStartIndex = new Int32Array(yearCount);
  let cellCount = 0;
  for (let r = 0; r < yearCount; r++) {
    const y = firstYear + r;
    const start = r === 0 ? dobCol : 0;
    let end = WEEKS - 1;
    if (y === expYear && y === lastYear) end = Math.min(end, expCol);
    if (end < start) end = start;
    rowStartCol[r] = start;
    rowEndCol[r] = end;
    rowStartIndex[r] = cellCount;
    cellCount += end - start + 1;
  }

  const cells = new Float32Array(cellCount * 4);
  let i = 0;
  for (let r = 0; r < yearCount; r++) {
    const baseV = yearBaseV(r);
    for (let c = rowStartCol[r]; c <= rowEndCol[r]; c++) {
      const o = i * 4;
      cells[o] = gridRect.x + (c % perRow) * cell;
      cells[o + 1] = gridRect.y + (baseV + Math.floor(c / perRow)) * cell;
      cells[o + 2] = cellW;
      cells[o + 3] = cellH;
      i++;
    }
  }

  const nowRow = clampInt(isoWeekYear(now) - firstYear, 0, yearCount - 1);
  // The current year's whole block — the slot a YEAR view nests into.
  const slotRect: Rect = {
    x: gridRect.x,
    y: gridRect.y + yearBaseV(nowRow) * cell,
    w: colW,
    h: subRows * cell,
  };

  const expRow = expYear - firstYear;
  let expectancyIndex = -1;
  if (
    expRow >= 0 &&
    expRow < yearCount &&
    expCol >= rowStartCol[expRow] &&
    expCol <= rowEndCol[expRow]
  ) {
    expectancyIndex = rowStartIndex[expRow] + (expCol - rowStartCol[expRow]);
  }

  // Age axis: one tick per year at the block's vertical centre; decade majors
  // carry the label. A single column, so every decade is labelled in place.
  const tickRows = yearCount;
  const left: AxisTick[] = [];
  for (let r = 0; r < tickRows; r++) {
    const major = r % 10 === 0;
    left.push({
      pos: gridRect.y + (yearBaseV(r) + subRows / 2) * cell,
      label: major ? String(r) : "",
      major,
    });
  }

  return {
    view: VIEW_LIFE,
    gridRect,
    cells,
    cellCount,
    cellW,
    cellH,
    slotRect,
    liveState: (t: Date): LiveState => {
      const r = clampInt(isoWeekYear(t) - firstYear, 0, yearCount - 1);
      const c = clampInt(isoWeek(t) - 1, rowStartCol[r], rowEndCol[r]);
      const index = rowStartIndex[r] + (c - rowStartCol[r]);
      const frac = (isoWeekday(t) - 1 + wallSeconds(t) / 86_400) / 7;
      return { index, frac, filled: index };
    },
    // Exact instanced-cell index for a date, or -1 when its ISO week is not on
    // the grid (before birth or after expectancy). A 53rd ISO week folds into
    // the 52nd column so a date there still resolves rather than dropping off.
    cellIndexForDate: (t: Date): number => {
      const r = isoWeekYear(t) - firstYear;
      if (r < 0 || r >= yearCount) return -1;
      const c = Math.min(WEEKS - 1, isoWeek(t) - 1);
      if (c < rowStartCol[r] || c > rowEndCol[r]) return -1;
      return rowStartIndex[r] + (c - rowStartCol[r]);
    },
    cellRect: makeCellRect(cells),
    axis: {
      left,
      top: [],
      // Labels exist only on decade rows — highlight the decade lived through.
      activeLeft:
        Math.floor(nowRow / 10) * 10 < tickRows
          ? Math.floor(nowRow / 10) * 10
          : -1,
      activeTop: -1,
    },
    activeAxis: (t: Date) => {
      const r = clampInt(isoWeekYear(t) - firstYear, 0, yearCount - 1);
      const d = Math.floor(r / 10) * 10;
      return { left: d < tickRows ? d : -1, top: -1 };
    },
    expectancyIndex,
  };
}

// ---------------------------------------------------------------------------
// Morph math (§4.1) — rect-to-rect anisotropic camera between a child view C
// and its parent P. easedP: 0 = child at rest full screen, 1 = parent at rest.
// The visible rect V(p) runs slot→parent (center lerp, per-axis exponential
// size); it is mapped onto W(p), which runs childRect→parentRect the same way,
// so both endpoints are exact even when a layout is letterboxed.

export interface MorphTransforms {
  child: LayerTransform;
  parent: LayerTransform;
}

interface AxisMap {
  scale: number;
  offset: number;
}

function axisTransform(
  sPos: number,
  sSize: number,
  cPos: number,
  cSize: number,
  pPos: number,
  pSize: number,
  e: number,
): AxisMap {
  const sC = sPos + sSize / 2;
  const cC = cPos + cSize / 2;
  const pC = pPos + pSize / 2;
  const vC = sC + (pC - sC) * e;
  const vS = sSize * Math.pow(pSize / sSize, e);
  const wC = cC + (pC - cC) * e;
  const wS = cSize * Math.pow(pSize / cSize, e);
  const scale = wS / vS;
  return { scale, offset: wC - scale * vC };
}

export function computeMorphTransforms(
  childLayout: ViewLayout,
  parentLayout: ViewLayout,
  gridArea: Rect,
  easedP: number,
): MorphTransforms {
  const slot = parentLayout.slotRect ?? gridArea;
  const childRect = childLayout.gridRect;
  const parentRect = parentLayout.gridRect;
  const px = axisTransform(
    slot.x,
    slot.w,
    childRect.x,
    childRect.w,
    parentRect.x,
    parentRect.w,
    easedP,
  );
  const py = axisTransform(
    slot.y,
    slot.h,
    childRect.y,
    childRect.h,
    parentRect.y,
    parentRect.h,
    easedP,
  );
  const parent: LayerTransform = {
    offsetX: px.offset,
    offsetY: py.offset,
    scaleX: px.scale,
    scaleY: py.scale,
  };
  // Child pre-squashed into the slot, then carried by the parent camera.
  const qScaleX = slot.w / childRect.w;
  const qScaleY = slot.h / childRect.h;
  const qOffsetX = slot.x - qScaleX * childRect.x;
  const qOffsetY = slot.y - qScaleY * childRect.y;
  const child: LayerTransform = {
    offsetX: px.offset + px.scale * qOffsetX,
    offsetY: py.offset + py.scale * qOffsetY,
    scaleX: px.scale * qScaleX,
    scaleY: py.scale * qScaleY,
  };
  return { child, parent };
}

/** Apply a LayerTransform to a layout-px rect. */
export function transformRect(t: LayerTransform, r: Rect): Rect {
  return {
    x: t.offsetX + t.scaleX * r.x,
    y: t.offsetY + t.scaleY * r.y,
    w: t.scaleX * r.w,
    h: t.scaleY * r.h,
  };
}

// ---------------------------------------------------------------------------
// Phase-timeline opacity envelopes (§4.2), pure functions of eased progress p
// (0 = child full screen, 1 = parent at rest).

export interface MorphEnvelope {
  /** Child layer opacity — fades out during the resolution crossfade. */
  childOpacity: number;
  /** Parent layer (sibling cells outside the slot) — sibling reveal. */
  parentOpacity: number;
  /** Parent's own cells inside the slot — resolution crossfade in. */
  slotInteriorOpacity: number;
  /** Slot outline stroke on the parent layer. */
  slotOutlineOpacity: number;
}

function ramp(p: number, from: number, to: number): number {
  if (p <= from) return 0;
  if (p >= to) return 1;
  return (p - from) / (to - from);
}

export function childOpacity(p: number): number {
  return 1 - ramp(p, 0.6, 0.85);
}

export function parentOpacity(p: number): number {
  return ramp(p, 0.15, 0.5);
}

export function slotInteriorOpacity(p: number): number {
  return ramp(p, 0.6, 0.85);
}

export function slotOutlineOpacity(p: number): number {
  return ramp(p, 0.05, 0.25) * (1 - ramp(p, 0.85, 1));
}

export function computeMorphEnvelope(easedP: number): MorphEnvelope {
  return {
    childOpacity: childOpacity(easedP),
    parentOpacity: parentOpacity(easedP),
    slotInteriorOpacity: slotInteriorOpacity(easedP),
    slotOutlineOpacity: slotOutlineOpacity(easedP),
  };
}
