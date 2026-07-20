// Life Clock — key moments & predictions.
// Pure: zero browser APIs, zero side effects; every function takes an explicit
// `now: Date` so results are deterministic and unit-testable in Node.
//
// Date arithmetic follows two rules, deliberately mixed:
//  - Whole-year human milestones (turning 18, leaving home, reaching a parent's
//    current age) use CALENDAR years, so the date lands on the actual birthday.
//  - Model quantities (expectancy, its halfway point, "twice as long as X")
//    use MS_PER_YEAR over 365.2425-day years, matching lib/life-clock.ts LIFE.

import {
  MS_PER_YEAR,
  estimateExpectancy,
  parseDob,
  type LifeProfile,
  type RelatedPerson,
  type Sex,
} from "@/lib/life-clock";
import type { ClockEvent } from "@/components/lab/life-clock/types";

export const EVENTS_DISCLAIMER =
  "These moments are arithmetic, not fortune-telling. Recorded dates are yours; " +
  "everything else is a population-level curve — a Gompertz–Makeham mortality " +
  "model fitted to modern high-income (NZ) life tables, plus a few coarse " +
  "developmental averages — applied to people it has never met. Real lives " +
  "miss these dates by years in both directions. Nothing here leaves this browser.";

/** Peer orientation overtakes parents in early adolescence (~12–14). */
const CHILD_PEERS_YEARS = 13;
/** NZ/AU median age of leaving the parental home sits early-to-mid twenties. */
const CHILD_LEAVES_YEARS = 22;
/** WHO healthy life expectancy (HALE) at birth, New Zealand, ~70 years. */
const HEALTHY_YEARS = 70;
/** Horizon for every probability scan — beyond this the curve is meaningless. */
const SOLVE_MAX_YEARS = 70;

/**
 * Gompertz–Makeham hazard: mu(x) = A + B * exp(theta * x).
 *
 * A (Makeham) is the age-independent background risk; B and theta are the
 * Gompertz senescent term. Values are least-squares-shaped to Stats NZ period
 * life tables 2020–22 (high-income, NZ): they reproduce e(68) male ~16.9 and
 * e(67) female ~20.5, the two anchors this feature actually depends on, and
 * hold within ~1 year of the published tables across ages 50–90. Below age 40
 * the fit is deliberately loose — no event in this module reads it there.
 *
 * Verified numerically: median remaining life is 17.0 yr for a 68-year-old male
 * and 21.1 yr for a 67-year-old female.
 */
interface GompertzMakeham {
  a: number;
  b: number;
  theta: number;
}

const HAZARD: Record<Sex, GompertzMakeham> = {
  male: { a: 0.0002, b: 2.0e-5, theta: 0.098 },
  female: { a: 0.00012, b: 1.0e-5, theta: 0.102 },
  unspecified: { a: 0.00016, b: 1.5e-5, theta: 0.1 },
};

/** S(x) = exp(-A·x - (B/theta)(e^(theta·x) - 1)) — survival from birth to age x. */
function survivalFromBirth(ageYears: number, h: GompertzMakeham): number {
  if (ageYears <= 0) return 1;
  return Math.exp(
    -h.a * ageYears - (h.b / h.theta) * (Math.exp(h.theta * ageYears) - 1),
  );
}

/**
 * P(person is alive at `at` | alive at `now`), from the sex-specific
 * Gompertz–Makeham curve above. Returns 1 for dates at or before `now`, and 0
 * for an unparseable dob.
 */
export function survivalProbability(
  person: RelatedPerson,
  at: Date,
  now: Date,
): number {
  const dob = parseDob(person.dob, now);
  if (dob === null) return 0;
  if (at.getTime() <= now.getTime()) return 1;
  const h = HAZARD[person.sex ?? "unspecified"];
  const ageNow = (now.getTime() - dob.getTime()) / MS_PER_YEAR;
  const ageAt = (at.getTime() - dob.getTime()) / MS_PER_YEAR;
  const s0 = survivalFromBirth(ageNow, h);
  if (s0 <= 0) return 0;
  return clamp01(survivalFromBirth(ageAt, h) / s0);
}

/**
 * First date at or after `from` where `predicate` reaches `target`, found by
 * scanning calendar months. Handles rising and falling predicates (direction is
 * taken from the value at `from`). Returns null if it never crosses within
 * `maxYears`.
 */
export function solveThresholdDate(
  predicate: (d: Date) => number,
  target: number,
  from: Date,
  maxYears: number,
): Date | null {
  const start = predicate(from);
  // Direction comes from the curve itself, not from where `start` sits relative
  // to `target` — otherwise an already-satisfied predicate reads as falling.
  const rising = predicate(addMonths(from, 1)) >= start;
  const reached = (v: number) => (rising ? v >= target : v <= target);
  if (reached(start)) return new Date(from.getTime());

  const months = Math.max(1, Math.round(maxYears * 12));
  for (let i = 1; i <= months; i += 1) {
    const d = addMonths(from, i);
    if (reached(predicate(d))) return d;
  }
  return null;
}

/**
 * Every event derivable from `profile`, ascending by date. Events whose inputs
 * are absent are omitted — a bare dob still yields the dob-derived set.
 */
export function buildEvents(profile: LifeProfile, now: Date): ClockEvent[] {
  const dob = parseDob(profile.dob, now);
  if (dob === null) return [];

  const events: ClockEvent[] = [];
  const people = profile.people;
  const expectancy = estimateExpectancy(profile, now);
  // Person labels are stored in natural case ("my wife", "my son", "Dad") and
  // read as first-person copy, so a name never shouts mid-sentence.
  const partner = people?.partnerLabel ?? "my partner";

  const met = people?.partnerMet ? parseDob(people.partnerMet, now) : null;
  const married = people?.partnerMarried
    ? parseDob(people.partnerMarried, now)
    : null;

  if (met) {
    events.push({
      id: "met",
      label: "The day we met",
      date: met,
      detail: `The day I met ${partner}. Everything since is on this side of it.`,
      basis: "RECORDED",
      certainty: "record",
      rangeStart: met,
      rangeEnd: now,
    });
    events.push({
      id: "partner-majority",
      label: `Longer with ${partner} than without`,
      date: mirror(dob, met),
      detail: `From this week, more of my life has been spent with ${partner} than without.`,
      basis: "MET + (MET - BIRTH)",
      certainty: "estimate",
      // The span the crossover refers to: time together, from meeting to now.
      rangeStart: met,
      rangeEnd: mirror(dob, met),
    });
  }

  if (married) {
    events.push({
      id: "married",
      label: "The day we married",
      date: married,
      detail: `The day I married ${partner}.`,
      basis: "RECORDED",
      certainty: "record",
      rangeStart: married,
      rangeEnd: now,
    });
    events.push({
      id: "married-longer",
      label: "Married longer than single",
      date: mirror(dob, married),
      detail:
        "From this week, I have been married for more of my life than I was single.",
      basis: "MARRIED + (MARRIED - BIRTH)",
      certainty: "estimate",
      // Married time, from the wedding to the crossover.
      rangeStart: married,
      rangeEnd: mirror(dob, married),
    });
  }

  const children = people?.children ?? [];
  children.forEach((child, i) => {
    const born = parseDob(child.dob, now);
    if (born === null) return;
    const who = child.label || "my child";
    const suffix = children.length > 1 ? `-${i}` : "";

    events.push({
      id: `child-born${suffix}`,
      label: `${capFirst(who)} was born`,
      date: born,
      detail: `The day ${who} came into the world.`,
      basis: "RECORDED",
      certainty: "record",
      rangeStart: born,
      rangeEnd: now,
    });

    const peers = addYears(born, CHILD_PEERS_YEARS);
    events.push({
      id: `child-peers${suffix}`,
      label: `${capFirst(who)} picks friends over me`,
      date: peers,
      detail: `Around here ${who} starts turning to friends first, and I stop being the daily centre of their world.`,
      basis: "BIRTH + 13Y — PEER ORIENTATION, EARLY ADOLESCENCE (12-14)",
      certainty: "estimate",
      rangeStart: born,
      rangeEnd: peers,
    });

    events.push({
      id: `child-18${suffix}`,
      label: `${capFirst(who)} turns 18`,
      date: addYears(born, 18),
      detail: `${capFirst(who)} becomes an adult.`,
      basis: "BIRTH + 18Y",
      certainty: "estimate",
      rangeStart: born,
      rangeEnd: addYears(born, 18),
    });

    const leaves = addYears(born, CHILD_LEAVES_YEARS);
    const spent = Math.round(
      clamp01(
        (now.getTime() - born.getTime()) / (leaves.getTime() - born.getTime()),
      ) * 100,
    );
    events.push({
      id: `child-leaves${suffix}`,
      label: `${capFirst(who)} leaves home`,
      date: leaves,
      detail: `${capFirst(who)} likely moves out around now — ${spent}% of the years spent living at home are already behind us.`,
      basis: "BIRTH + 22Y — NZ/AU MEDIAN AGE LEAVING HOME",
      certainty: "estimate",
      rangeStart: born,
      rangeEnd: leaves,
    });
  });

  const parents = (people?.parents ?? []).filter(
    (p) => parseDob(p.dob, now) !== null,
  );
  if (parents.length > 0) {
    const anyDead = (d: Date) =>
      1 - parents.reduce((acc, p) => acc * survivalProbability(p, d, now), 1);
    const allDead = (d: Date) =>
      parents.reduce((acc, p) => acc * (1 - survivalProbability(p, d, now)), 1);

    const oneHalf = solveThresholdDate(anyDead, 0.5, now, SOLVE_MAX_YEARS);
    if (oneHalf) {
      events.push({
        id: "parents-one-50",
        label:
          parents.length > 1 ? "One parent likely gone" : "A parent likely gone",
        date: oneHalf,
        detail:
          parents.length > 1
            ? "By this week, it is more likely than not that I have lost at least one of my parents."
            : "By this week, it is more likely than not that I have lost my parent.",
        basis: "GOMPERTZ-MAKEHAM, NZ PERIOD TABLE, INDEPENDENT — P >= 0.50",
        certainty: "probability",
        rangeStart: now,
        rangeEnd: oneHalf,
      });
    }

    if (parents.length > 1) {
      const bothHalf = solveThresholdDate(allDead, 0.5, now, SOLVE_MAX_YEARS);
      if (bothHalf) {
        events.push({
          id: "parents-both-50",
          label: "Both parents likely gone",
          date: bothHalf,
          detail:
            "By this week, it is more likely than not that both my parents are gone.",
          basis: "GOMPERTZ-MAKEHAM, NZ PERIOD TABLE, INDEPENDENT — P >= 0.50",
          certainty: "probability",
          rangeStart: now,
          rangeEnd: bothHalf,
        });
      }
      const bothNinety = solveThresholdDate(allDead, 0.9, now, SOLVE_MAX_YEARS);
      if (bothNinety) {
        events.push({
          id: "parents-both-90",
          label: "Almost certainly no parents",
          date: bothNinety,
          detail:
            "By this week, there is a nine-in-ten chance both my parents are gone.",
          basis: "GOMPERTZ-MAKEHAM, NZ PERIOD TABLE, INDEPENDENT — P >= 0.90",
          certainty: "probability",
          rangeStart: now,
          rangeEnd: bothNinety,
        });
      }
    }

    const oldest = oldestParent(parents, now);
    if (oldest) {
      const oldestDob = parseDob(oldest.dob, now);
      if (oldestDob) {
        const age = Math.floor((now.getTime() - oldestDob.getTime()) / MS_PER_YEAR);
        const who = oldest.label || "my parent";
        const date = addYears(dob, age);
        events.push({
          id: "parent-age-now",
          label: `The age ${who} is now`,
          date,
          detail: `I turn ${age} — the age ${who} is right now.`,
          basis: "BIRTH + PARENT'S CURRENT AGE",
          certainty: "estimate",
          rangeStart: dob,
          rangeEnd: date,
        });
      }
    }
  }

  // Crossroads — the moments a life could have forked. Recorded facts, but
  // rendered apart from the ordinary records: hovering one lifts everything
  // downstream, from the fork to now, as the consequence it set in motion.
  const crossroads = profile.crossroads ?? [];
  crossroads.forEach((crossroad, i) => {
    const at = parseDob(crossroad.date, now);
    if (at === null) return;
    const suffix = crossroads.length > 1 ? `-${i}` : "";
    events.push({
      id: `crossroad${suffix}`,
      label: capFirst(crossroad.label || "A crossroads"),
      date: at,
      detail: crossroad.detail,
      basis: "A FORK IN THE PATH — RECORDED",
      certainty: "record",
      crossroad: true,
      rangeStart: earlier(at, now),
      rangeEnd: later(at, now),
    });
  });

  const halfway = new Date(dob.getTime() + (expectancy / 2) * MS_PER_YEAR);
  events.push({
    id: "halfway",
    label: "Halfway",
    date: halfway,
    detail: "The midpoint of my estimated span — as much behind me as ahead.",
    basis: "BIRTH + EXPECTANCY / 2",
    certainty: "estimate",
    rangeStart: dob,
    rangeEnd: halfway,
  });

  const healthy = addYears(dob, HEALTHY_YEARS);
  events.push({
    id: "healthy-years",
    label: "My last good years",
    date: healthy,
    detail:
      "Around here the healthy years typically run out; what comes after is usually lived with something wrong.",
    basis: "WHO HALE AT BIRTH, NZ ~70Y",
    certainty: "estimate",
    rangeStart: earlier(now, healthy),
    rangeEnd: later(now, healthy),
  });

  const end = new Date(dob.getTime() + expectancy * MS_PER_YEAR);
  events.push({
    id: "expectancy-end",
    label: "The estimate runs out",
    date: end,
    detail: "The end of my estimated span. The grid stops here.",
    basis: "BIRTH + EXPECTANCY",
    certainty: "estimate",
    // The remaining life, from now to the end — not the whole grid.
    rangeStart: earlier(now, end),
    rangeEnd: later(now, end),
  });

  events.sort((a, b) => a.date.getTime() - b.date.getTime() || cmp(a.id, b.id));
  return events;
}

function oldestParent(parents: RelatedPerson[], now: Date): RelatedPerson | null {
  let best: RelatedPerson | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const p of parents) {
    const d = parseDob(p.dob, now);
    if (d === null) continue;
    if (d.getTime() < bestMs) {
      bestMs = d.getTime();
      best = p;
    }
  }
  return best;
}

/** Capitalize the first letter only ("my son" → "My son", "Dad" → "Dad"). */
function capFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** The date as far after `pivot` as `pivot` is after `origin`. */
function mirror(origin: Date, pivot: Date): Date {
  return new Date(2 * pivot.getTime() - origin.getTime());
}

function addYears(d: Date, years: number): Date {
  const out = new Date(
    d.getFullYear() + years,
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  // Feb 29 + n years lands on Mar 1 in a common year; pull it back to Feb 28.
  if (out.getMonth() !== d.getMonth()) out.setDate(0);
  return out;
}

function addMonths(d: Date, months: number): Date {
  const target = d.getMonth() + months;
  const out = new Date(
    d.getFullYear(),
    target,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  if (out.getMonth() !== ((target % 12) + 12) % 12) out.setDate(0);
  return out;
}

function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function later(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
