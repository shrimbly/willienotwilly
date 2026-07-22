// Perspective Clock — static dataset for the five UI-direction mockups.
// Everything is derived once, at module load, from the author profile at a
// FIXED instant, so the mockup pages are fully deterministic server renders
// with zero client JS. Pure derivation over lib/life-clock + lib/life-events;
// nothing here touches the browser.

import {
  DISCLAIMER_SHORT,
  MS_PER_DAY,
  MS_PER_YEAR,
  PERCENT_DECIMALS,
  formatClock,
  formatLifeRemaining,
  formatPercent,
  getExpectancyDate,
  getLifeProgress,
  isoWeek,
  isoWeekYear,
  isoWeekday,
  parseDob,
} from "@/lib/life-clock";
import { DEFAULT_PROFILE } from "@/lib/life-clock-storage";
import { EVENTS_DISCLAIMER, buildEvents } from "@/lib/life-events";
import { buildPlaceBands, type PlaceBand, placeYears } from "@/lib/life-places";
import { eventSymbol } from "@/components/lab/life-clock/types";

/** The frozen instant every mockup renders: Wed 2026-07-22, 09:41:07 local. */
export const NOW = new Date(2026, 6, 22, 9, 41, 7);

export type WeekState = "lived" | "live" | "future";

export interface StaticWeek {
  /** ISO week column 0..51 (week 53 folds into 51, matching the layout engine). */
  col: number;
  state: WeekState;
  /** Hex of the place lived that week, when one covers it. */
  place?: string;
}

export interface StaticYearRow {
  year: number;
  /** Age reached during this row — also the row index. */
  age: number;
  startCol: number;
  endCol: number;
  weeks: StaticWeek[];
}

export interface StaticEvent {
  /** 1-based chronological index across all events. */
  n: number;
  id: string;
  label: string;
  detail: string;
  basis: string;
  /** Card kind label: RECORD | ESTIMATE | PROBABILITY | CROSSROAD. */
  kind: string;
  /** Marker glyph: ● ✱ ◇ ◆. */
  symbol: string;
  crossroad: boolean;
  date: Date;
  dateStr: string;
  /** "IN 5Y 3M" / "2Y AGO" / "TODAY". */
  relative: string;
  isPast: boolean;
  ageAt: number;
  /** Position along the whole span, 0 = birth, 1 = expectancy end. */
  t: number;
  /** Grid position (row = year index, col = ISO week 0..51). */
  row: number;
  col: number;
}

export interface StaticPlace {
  label: string;
  hex: string;
  /** "1991–2009" / "2021–now". */
  years: string;
  /** Span in whole-life fractions, for linear/radial layouts. */
  tStart: number;
  tEnd: number;
  ongoing: boolean;
  /** Length of the stay, e.g. "18.0 YR". */
  duration: string;
}

export interface PerspectiveData {
  now: Date;
  clock: string;
  dateStr: string;
  weekday: string;
  tz: string;
  modeLine: string;
  elapsedPct: string;
  remaining: string;
  cellText: string;
  ageYears: number;
  expectancyYears: number;
  fraction: number;
  weeksLived: number;
  totalWeeks: number;
  dob: Date;
  dobStr: string;
  expectancyDate: Date;
  expectancyStr: string;
  firstYear: number;
  yearCount: number;
  nowRow: number;
  nowCol: number;
  years: StaticYearRow[];
  events: StaticEvent[];
  places: StaticPlace[];
  disclaimerShort: string;
  disclaimerLong: string;
}

export const VIEW_NAMES = ["DAY", "WEEK", "YEAR", "LIFE"] as const;

export const SYMBOL_KEY = [
  { symbol: "●", label: "RECORD" },
  { symbol: "✱", label: "ESTIMATE" },
  { symbol: "◇", label: "PROBABILITY" },
  { symbol: "◆", label: "CROSSROAD" },
] as const;

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Mix two hex colours; t = weight of `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    const v = Math.round(va + (vb - va) * t);
    return v.toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * Stack labels along one axis: keep each at its target when possible, push
 * down to preserve `gap`, then pull the tail back inside [lo, hi].
 */
export function dodge(
  targets: number[],
  gap: number,
  lo: number,
  hi: number,
): number[] {
  const out: number[] = [];
  let prev = lo - gap;
  for (const t of targets) {
    const y = Math.max(Math.max(t, lo), prev + gap);
    out.push(y);
    prev = y;
  }
  for (let i = out.length - 1, cap = hi; i >= 0; i--, cap -= gap) {
    if (out[i] > cap) out[i] = cap;
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i] < out[i - 1] + gap) out[i] = out[i - 1] + gap;
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-aware distance from `now` — same rules as the live hover card. */
export function formatRelative(date: Date, now: Date): string {
  const a = startOfDay(now);
  const b = startOfDay(date);
  if (a.getTime() === b.getTime()) return "TODAY";
  const future = b.getTime() > a.getTime();
  const from = future ? a : b;
  const to = future ? b : a;
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
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

/** Monday of an ISO week (Jan 4 is always inside week 1). */
function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - (isoWeekday(jan4) - 1) + (week - 1) * 7);
}

function placeAt(bands: PlaceBand[], d: Date): PlaceBand | undefined {
  // Later bands win a shared week, matching the live grid tint.
  let hit: PlaceBand | undefined;
  for (const b of bands) {
    if (b.start.getTime() <= d.getTime() && d.getTime() < b.end.getTime()) {
      hit = b;
    }
  }
  return hit;
}

function buildStaticData(): PerspectiveData {
  const profile = DEFAULT_PROFILE;
  const now = NOW;
  const dob = parseDob(profile.dob, now);
  if (!dob) throw new Error("static-data: invalid author dob");
  const expectancyDate = getExpectancyDate(profile, now);
  const lp = getLifeProgress(now, profile);
  const bands = buildPlaceBands(profile, now);

  const firstYear = isoWeekYear(dob);
  const expYear = isoWeekYear(expectancyDate);
  const lastYear = Math.max(expYear, isoWeekYear(now), firstYear);
  const yearCount = lastYear - firstYear + 1;
  const dobCol = Math.min(51, isoWeek(dob) - 1);
  const expCol = Math.min(51, isoWeek(expectancyDate) - 1);
  const nowRow = Math.min(yearCount - 1, isoWeekYear(now) - firstYear);
  const nowCol = Math.min(51, isoWeek(now) - 1);

  const years: StaticYearRow[] = [];
  for (let r = 0; r < yearCount; r++) {
    const year = firstYear + r;
    const startCol = r === 0 ? dobCol : 0;
    let endCol = 51;
    if (year === expYear && year === lastYear) endCol = Math.max(startCol, expCol);
    const weeks: StaticWeek[] = [];
    for (let c = startCol; c <= endCol; c++) {
      const state: WeekState =
        r < nowRow || (r === nowRow && c < nowCol)
          ? "lived"
          : r === nowRow && c === nowCol
            ? "live"
            : "future";
      const week: StaticWeek = { col: c, state };
      if (state !== "future") {
        const mid = new Date(isoWeekStart(year, c + 1).getTime() + 3.5 * MS_PER_DAY);
        const band = placeAt(bands, mid);
        if (band) week.place = band.hex;
      }
      weeks.push(week);
    }
    years.push({ year, age: r, startCol, endCol, weeks });
  }

  const lifeSpanMs = expectancyDate.getTime() - dob.getTime();
  const events: StaticEvent[] = buildEvents(profile, now).map((e, i) => {
    const row = Math.min(
      yearCount - 1,
      Math.max(0, isoWeekYear(e.date) - firstYear),
    );
    const col = Math.min(51, isoWeek(e.date) - 1);
    return {
      n: i + 1,
      id: e.id,
      label: e.label,
      detail: e.detail,
      basis: e.basis,
      kind: e.crossroad ? "CROSSROAD" : e.certainty.toUpperCase(),
      symbol: eventSymbol(e),
      crossroad: e.crossroad === true,
      date: e.date,
      dateStr: formatDateStr(e.date),
      relative: formatRelative(e.date, now),
      isPast: e.date.getTime() <= now.getTime(),
      ageAt: (e.date.getTime() - dob.getTime()) / MS_PER_YEAR,
      t: (e.date.getTime() - dob.getTime()) / lifeSpanMs,
      row,
      col,
    };
  });

  const places: StaticPlace[] = bands.map((b) => ({
    label: b.label,
    hex: b.hex,
    years: placeYears(b),
    tStart: (b.start.getTime() - dob.getTime()) / lifeSpanMs,
    tEnd: (b.end.getTime() - dob.getTime()) / lifeSpanMs,
    ongoing: b.ongoing,
    duration: `${((b.end.getTime() - b.start.getTime()) / MS_PER_YEAR).toFixed(1)} YR`,
  }));

  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return {
    now,
    clock: formatClock(now),
    dateStr: formatDateStr(now),
    weekday: WEEKDAYS[now.getDay()],
    // The mockups are frozen at NZST; hardcoded so the render is deterministic.
    tz: "GMT+12",
    modeLine: `LIFE · AGE ${lp.ageYears.toFixed(2)}/${lp.expectancyYears.toFixed(2)}`,
    elapsedPct: formatPercent(lp.fraction, PERCENT_DECIMALS.life),
    remaining: formatLifeRemaining(lp.msRemaining),
    cellText: `${fmtInt(lp.weeksLived)}/${fmtInt(lp.totalWeeks)}`,
    ageYears: lp.ageYears,
    expectancyYears: lp.expectancyYears,
    fraction: lp.fraction,
    weeksLived: lp.weeksLived,
    totalWeeks: lp.totalWeeks,
    dob,
    dobStr: formatDateStr(dob),
    expectancyDate,
    expectancyStr: formatDateStr(expectancyDate),
    firstYear,
    yearCount,
    nowRow,
    nowCol,
    years,
    events,
    places,
    disclaimerShort: DISCLAIMER_SHORT,
    disclaimerLong: EVENTS_DISCLAIMER,
  };
}

export const DATA: PerspectiveData = buildStaticData();
