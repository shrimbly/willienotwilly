// Life Clock — pure time/expectancy model.
// Zero browser APIs, zero side effects; every function takes an explicit
// `now: Date` so results are deterministic and unit-testable in Node.
//
// Time-domain rule: DAY/WEEK/MONTH/YEAR use local wall-clock components
// (never epoch subtraction) so the grid always agrees with the displayed
// HH:MM:SS — DST days render as exactly 86,400 s with a one-time ±720-cell
// jump at the transition. LIFE uses raw epoch-ms over 365.2425-day years,
// where DST/timezone error is ~1e-5 of a lifetime.

export const SECONDS_PER_CELL = 5;
export const CELLS_PER_DAY = 17_280; // 86400 / 5
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_WEEK = 604_800;
export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 604_800_000;
export const DAYS_PER_YEAR = 365.2425; // Gregorian mean
export const MS_PER_YEAR = 31_556_952_000; // DAYS_PER_YEAR * MS_PER_DAY, exact
export const MAX_EXPECTANCY_YEARS = 105;

export const EXPECTANCY_DISCLAIMER =
  "This is an art piece, not an actuarial product. The estimate combines " +
  "population life tables (OECD/WHO period life expectancy at birth) with a " +
  "few coarse, population-level adjustments. It is not a prediction, not a " +
  "diagnosis, and not medical advice — individual outcomes vary by decades. " +
  "Your answers never leave this browser.";

export const DISCLAIMER_SHORT = "ESTIMATE, NOT PROPHECY";

export type Sex = "female" | "male" | "unspecified";
export type Smoking = "never" | "former" | "current";
export type Exercise = "rarely" | "weekly" | "often";
export type Region =
  | "east-asia"
  | "western-europe-oceania"
  | "united-states"
  | "latin-america"
  | "mena"
  | "eastern-europe-central-asia"
  | "south-southeast-asia"
  | "sub-saharan-africa"
  | "unspecified";

/** A person the clock derives events from. `dob` is "YYYY-MM-DD". */
export interface RelatedPerson {
  /** Short label used in event copy, e.g. "DAD". Uppercase by convention. */
  label: string;
  dob: string;
  /** Drives sex-specific mortality curves for parent predictions. */
  sex?: Sex;
}

/**
 * Optional relationships. Every field is independent — events that lack
 * their inputs are simply not generated, so a bare dob still works.
 */
export interface LifePeople {
  /** Label for the partner in event copy, e.g. "MY WIFE". */
  partnerLabel?: string;
  /** "YYYY-MM-DD" — the day you met. */
  partnerMet?: string;
  /** "YYYY-MM-DD" — the day you married. */
  partnerMarried?: string;
  children?: RelatedPerson[];
  parents?: RelatedPerson[];
}

/**
 * A place lived, as a half-open span on the life timeline. `end` omitted means
 * "up to now". Drives the PLACES overlay bands on the LIFE grid.
 */
export interface LifePlace {
  /** Short label for the legend, e.g. "Wellington". */
  label: string;
  /** "YYYY-MM-DD" — arrival. */
  start: string;
  /** "YYYY-MM-DD" — departure; omitted = still there. */
  end?: string;
}

/**
 * A crossroads — a dated moment where the life could have forked, with the
 * counterfactual that makes it one. Rendered as a distinct violet marker.
 */
export interface LifeCrossroad {
  /** Short label, e.g. "The exam that redirected me". */
  label: string;
  /** "YYYY-MM-DD" — when the fork happened. */
  date: string;
  /** The what-if: what this moment set in motion, or foreclosed. */
  detail: string;
}

export interface LifeProfile {
  v: 2;
  /** "YYYY-MM-DD", validated real calendar date, 1900-01-01..today */
  dob: string;
  sex: Sex;
  smoking: Smoking;
  exercise: Exercise;
  region: Region;
  /** Relationships driving the life-event markers; absent = none. */
  people?: LifePeople;
  /** Places lived, for the PLACES overlay; absent = no overlay offered. */
  places?: LifePlace[];
  /** Life-forking moments, rendered as crossroad markers; absent = none. */
  crossroads?: LifeCrossroad[];
  /** true only for the hardcoded author profile; never persisted. */
  author?: boolean;
  /** true when created by SKIP — renderer shows the DEMO badge */
  demo: boolean;
  /** ISO 8601 UTC; informational only, never used in math */
  savedAt: string;
}

export type ClockView = "day" | "week" | "month" | "year" | "life";

export interface DayProgress {
  elapsedSeconds: number; // [0, 86400) float
  remainingSeconds: number; // 86400 − elapsedSeconds
  fraction: number; // [0, 1)
  liveCellIndex: number; // [0, 17279]
  cellFraction: number; // [0, 1) fill of the live cell
  filledCells: number; // == liveCellIndex
}

export interface WeekProgress {
  dayIndex: number; // 0 = Monday … 6 = Sunday
  elapsedSeconds: number; // [0, 604800)
  totalSeconds: number; // 604800
  remainingSeconds: number;
  fraction: number; // [0, 1)
}

export interface MonthProgress {
  dayOfMonth: number;
  daysInMonth: number;
  elapsedSeconds: number;
  totalSeconds: number;
  remainingSeconds: number;
  fraction: number;
}

export interface YearProgress {
  dayOfYear: number; // 1-based, 1..366
  daysInYear: number; // 365 | 366
  elapsedSeconds: number;
  totalSeconds: number;
  remainingSeconds: number;
  fraction: number;
}

export interface LifeProgress {
  ageYears: number; // float
  expectancyYears: number; // clamped, see estimateExpectancy
  msLived: number;
  msTotal: number;
  msRemaining: number;
  fraction: number; // [0, 0.9999]
  weeksLived: number;
  totalWeeks: number;
  daysLived: number;
  totalDays: number;
}

const SEX_BASELINE: Record<Sex, number> = {
  female: 83,
  male: 78,
  unspecified: 80.5,
};

const SMOKING_ADJ: Record<Smoking, number> = {
  never: 0,
  former: -2,
  current: -9,
};

const EXERCISE_ADJ: Record<Exercise, number> = {
  rarely: -2,
  weekly: 1,
  often: 3,
};

const REGION_ADJ: Record<Region, number> = {
  "east-asia": 2,
  "western-europe-oceania": 1,
  "united-states": -1,
  "latin-america": -3,
  mena: -2,
  "eastern-europe-central-asia": -4,
  "south-southeast-asia": -5,
  "sub-saharan-africa": -9,
  unspecified: 0,
};

/** ELAPSED percent decimals per mode (R4): last digit ticks every 0.5–3.5 s. */
export const PERCENT_DECIMALS = {
  day: 3,
  week: 4,
  year: 5,
  life: 7,
} as const;

function dayElapsedSeconds(now: Date): number {
  return (
    now.getHours() * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds() +
    now.getMilliseconds() / 1000
  );
}

/**
 * Day progress from local wall-clock components. Always 17,280 cells;
 * DST days jump 720 cells at the transition.
 */
export function getDayProgress(now: Date): DayProgress {
  const elapsedSeconds = dayElapsedSeconds(now);
  const liveCellIndex = Math.min(
    CELLS_PER_DAY - 1,
    Math.floor(elapsedSeconds / SECONDS_PER_CELL),
  );
  return {
    elapsedSeconds,
    remainingSeconds: SECONDS_PER_DAY - elapsedSeconds,
    fraction: elapsedSeconds / SECONDS_PER_DAY,
    liveCellIndex,
    cellFraction: (elapsedSeconds % SECONDS_PER_CELL) / SECONDS_PER_CELL,
    filledCells: liveCellIndex,
  };
}

/** Week progress; week starts Monday 00:00 local (ISO 8601). */
export function getWeekProgress(now: Date): WeekProgress {
  const dayIndex = (now.getDay() + 6) % 7;
  const elapsedSeconds = dayIndex * SECONDS_PER_DAY + dayElapsedSeconds(now);
  return {
    dayIndex,
    elapsedSeconds,
    totalSeconds: SECONDS_PER_WEEK,
    remainingSeconds: SECONDS_PER_WEEK - elapsedSeconds,
    fraction: elapsedSeconds / SECONDS_PER_WEEK,
  };
}

/** Calendar-correct month progress (28–31 days). */
export function getMonthProgress(now: Date): MonthProgress {
  const dayOfMonth = now.getDate();
  const days = daysInMonth(now.getFullYear(), now.getMonth());
  const elapsedSeconds = (dayOfMonth - 1) * SECONDS_PER_DAY + dayElapsedSeconds(now);
  const totalSeconds = days * SECONDS_PER_DAY;
  return {
    dayOfMonth,
    daysInMonth: days,
    elapsedSeconds,
    totalSeconds,
    remainingSeconds: totalSeconds - elapsedSeconds,
    fraction: elapsedSeconds / totalSeconds,
  };
}

/** Leap-aware year progress (365/366 days). */
export function getYearProgress(now: Date): YearProgress {
  const doy = dayOfYear(now);
  const daysInYear = isLeapYear(now.getFullYear()) ? 366 : 365;
  const elapsedSeconds = (doy - 1) * SECONDS_PER_DAY + dayElapsedSeconds(now);
  const totalSeconds = daysInYear * SECONDS_PER_DAY;
  return {
    dayOfYear: doy,
    daysInYear,
    elapsedSeconds,
    totalSeconds,
    remainingSeconds: totalSeconds - elapsedSeconds,
    fraction: elapsedSeconds / totalSeconds,
  };
}

/**
 * Life progress from epoch-ms difference over 365.2425-day years.
 * Fraction hard-capped at 0.9999 — the clock never renders complete.
 */
export function getLifeProgress(now: Date, profile: LifeProfile): LifeProgress {
  const dobDate = requireDob(profile, now);
  const msLived = now.getTime() - dobDate.getTime();
  const expectancyYears = estimateExpectancy(profile, now);
  const msTotal = expectancyYears * MS_PER_YEAR;
  return {
    ageYears: msLived / MS_PER_YEAR,
    expectancyYears,
    msLived,
    msTotal,
    msRemaining: Math.max(0, msTotal - msLived),
    fraction: Math.min(msLived / msTotal, 0.9999),
    weeksLived: Math.floor(msLived / MS_PER_WEEK),
    totalWeeks: Math.round((expectancyYears * DAYS_PER_YEAR) / 7),
    daysLived: Math.floor(msLived / MS_PER_DAY),
    totalDays: Math.round(expectancyYears * DAYS_PER_YEAR),
  };
}

/** Unclamped table sum: baseline(sex) + region + smoking + exercise. */
export function estimateExpectancyRaw(
  profile: Pick<LifeProfile, "sex" | "smoking" | "exercise" | "region">,
): number {
  return (
    SEX_BASELINE[profile.sex] +
    REGION_ADJ[profile.region] +
    SMOKING_ADJ[profile.smoking] +
    EXERCISE_ADJ[profile.exercise]
  );
}

/** Clamped estimate used by the clock: max(ageYears + 1, min(105, raw)). */
export function estimateExpectancy(profile: LifeProfile, now: Date): number {
  const dobDate = requireDob(profile, now);
  const ageYears = (now.getTime() - dobDate.getTime()) / MS_PER_YEAR;
  const raw = estimateExpectancyRaw(profile);
  return Math.max(ageYears + 1, Math.min(MAX_EXPECTANCY_YEARS, raw));
}

/** dob + expectancy·MS_PER_YEAR — the LIFE grid's bottom-row anchor. */
export function getExpectancyDate(profile: LifeProfile, now: Date): Date {
  const dobDate = requireDob(profile, now);
  return new Date(
    dobDate.getTime() + estimateExpectancy(profile, now) * MS_PER_YEAR,
  );
}

function requireDob(profile: LifeProfile, now: Date): Date {
  const dobDate = parseDob(profile.dob, now);
  if (dobDate === null) {
    throw new Error(`Invalid dob in profile: "${profile.dob}"`);
  }
  return dobDate;
}

/**
 * Parse "YYYY-MM-DD" to LOCAL midnight (never `new Date(string)` — that is
 * UTC midnight and shifts a day in negative-offset zones). Returns null on
 * bad format, impossible date, or out of range 1900-01-01..now.
 */
export function parseDob(dob: string, now: Date): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  const ms = date.getTime();
  if (ms < new Date(1900, 0, 1).getTime() || ms > now.getTime()) return null;
  return date;
}

/** Generic live-cell helper: min(cellCount − 1, floor(fraction · cellCount)). */
export function cellIndexFor(fraction: number, cellCount: number): number {
  return Math.max(0, Math.min(cellCount - 1, Math.floor(fraction * cellCount)));
}

/** Convenience: fraction for any view. "life" requires profile. */
export function getFraction(
  view: ClockView,
  now: Date,
  profile?: LifeProfile,
): number {
  switch (view) {
    case "day":
      return getDayProgress(now).fraction;
    case "week":
      return getWeekProgress(now).fraction;
    case "month":
      return getMonthProgress(now).fraction;
    case "year":
      return getYearProgress(now).fraction;
    case "life":
      if (!profile) throw new Error('getFraction("life") requires a profile');
      return getLifeProgress(now, profile).fraction;
  }
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Days in month, month0 = 0..11. */
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** 1-based day of year, 1..366. */
export function dayOfYear(d: Date): number {
  const m0 = d.getMonth();
  return (
    CUM_DAYS[m0] +
    d.getDate() +
    (m0 > 1 && isLeapYear(d.getFullYear()) ? 1 : 0)
  );
}

/** ISO 8601 weekday: Mon=1 … Sun=7. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** ISO 8601 week number (Thursday rule), 1..53. */
export function isoWeek(d: Date): number {
  const thursday = isoThursday(d);
  return Math.floor((dayOfYear(thursday) - 1) / 7) + 1;
}

/** The ISO year owning d's week (year containing that week's Thursday). */
export function isoWeekYear(d: Date): number {
  return isoThursday(d).getFullYear();
}

/** Weeks in an ISO year: ISO week of Dec 28 (always the last week) → 52 | 53. */
export function weeksInIsoYear(year: number): number {
  return isoWeek(new Date(year, 11, 28));
}

function isoThursday(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (4 - isoWeekday(d)));
}

/** Local 24h clock, zero-padded: "04:07:32". */
export function formatClock(now: Date): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

/** Local date: "2026-07-19". */
export function formatDate(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Percent at a fixed decimal count, FLOORED (never rounds up — the clock
 * must never show a premature completion). Input clamped to [0, 1].
 */
export function formatPercent(fraction: number, decimals: number): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  const scaled = Math.floor(clamped * 10 ** (decimals + 2));
  return (scaled / 10 ** decimals).toFixed(decimals) + "%";
}

/** Duration from seconds (floored). ≥ 1 day: "3D 04:12:05"; else "04:12:05". */
export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const days = Math.floor(total / SECONDS_PER_DAY);
  const hms = formatHms(total % SECONDS_PER_DAY);
  return days >= 1 ? `${days}D ${hms}` : hms;
}

/** Life-scale span: "46Y 213D". */
export function formatYearsDays(ms: number): string {
  const years = Math.floor(ms / MS_PER_YEAR);
  const days = Math.floor((ms % MS_PER_YEAR) / MS_PER_DAY);
  return `${years}Y ${days}D`;
}

/** Expectancy, always one decimal for stable width: "81.5 YR" (R5). */
export function formatExpectancy(years: number): string {
  return `${years.toFixed(1)} YR`;
}

/** DAY remaining: "T-09:27:55". */
export function formatDayRemaining(remainingSeconds: number): string {
  return `T-${formatHms(Math.max(0, Math.floor(remainingSeconds)))}`;
}

/** WEEK remaining: "T-3D 15:12:44" (day count not zero-padded, keeps seconds). */
export function formatWeekRemaining(remainingSeconds: number): string {
  const total = Math.max(0, Math.floor(remainingSeconds));
  const days = Math.floor(total / SECONDS_PER_DAY);
  return `T-${days}D ${formatHms(total % SECONDS_PER_DAY)}`;
}

/** YEAR remaining: "T-165D 09:27" (drops seconds, keeps minutes). */
export function formatYearRemaining(remainingSeconds: number): string {
  const total = Math.max(0, Math.floor(remainingSeconds));
  const days = Math.floor(total / SECONDS_PER_DAY);
  const rest = total % SECONDS_PER_DAY;
  return `T-${days}D ${pad2(Math.floor(rest / 3600))}:${pad2(Math.floor((rest % 3600) / 60))}`;
}

/** LIFE remaining: "T-50.79 YR" (2-dp years). */
export function formatLifeRemaining(msRemaining: number): string {
  return `T-${(Math.max(0, msRemaining) / MS_PER_YEAR).toFixed(2)} YR`;
}

function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
