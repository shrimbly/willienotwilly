import { describe, expect, it } from "vitest";

import {
  EVENTS_DISCLAIMER,
  buildEvents,
  solveThresholdDate,
  survivalProbability,
} from "@/lib/life-events";
import { MS_PER_YEAR, type LifeProfile, type RelatedPerson } from "@/lib/life-clock";
import type { ClockEvent } from "@/components/lab/life-clock/types";

const NOW = new Date(2026, 6, 20, 12, 0, 0);

const DAD: RelatedPerson = { label: "Dad", dob: "1958-01-01", sex: "male" };
const MUM: RelatedPerson = { label: "Mum", dob: "1959-01-01", sex: "female" };

const AUTHOR: LifeProfile = {
  v: 2,
  dob: "1989-01-01",
  sex: "male",
  smoking: "never",
  exercise: "weekly",
  region: "western-europe-oceania",
  people: {
    partnerLabel: "my wife",
    partnerMet: "2010-04-08",
    partnerMarried: "2021-02-13",
    children: [{ label: "my son", dob: "2023-10-30", sex: "male" }],
    parents: [DAD, MUM],
  },
  demo: false,
  savedAt: "2026-07-20T00:00:00.000Z",
};

const BARE: LifeProfile = {
  v: 2,
  dob: "1989-01-01",
  sex: "male",
  smoking: "never",
  exercise: "weekly",
  region: "western-europe-oceania",
  demo: false,
  savedAt: "2026-07-20T00:00:00.000Z",
};

function byId(events: ClockEvent[], id: string): ClockEvent {
  const found = events.find((e) => e.id === id);
  if (!found) throw new Error(`missing event: ${id}`);
  return found;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Median remaining years given P(alive) as a function of elapsed years. */
function medianRemaining(person: RelatedPerson, now: Date): number {
  let lo = 0;
  let hi = 70;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const at = new Date(now.getTime() + mid * MS_PER_YEAR);
    if (survivalProbability(person, at, now) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe("buildEvents — author's default profile", () => {
  const events = buildEvents(AUTHOR, NOW);

  it("produces the full event set", () => {
    expect(events.map((e) => e.id)).toEqual([
      "met",
      "married",
      "child-born",
      "halfway",
      "partner-majority",
      "child-peers",
      "parents-one-50",
      "child-18",
      "child-leaves",
      "parents-both-50",
      "married-longer",
      "parent-age-now",
      "parents-both-90",
      "healthy-years",
      "expectancy-end",
    ]);
  });

  it("dates the records exactly as recorded", () => {
    expect(ymd(byId(events, "met").date)).toBe("2010-04-08");
    expect(ymd(byId(events, "married").date)).toBe("2021-02-13");
    expect(ymd(byId(events, "child-born").date)).toBe("2023-10-30");
  });

  it("dates the derived moments", () => {
    // met + (met - dob): 1989-01-01 -> 2010-04-08 is 7767 days; +7767 days.
    expect(ymd(byId(events, "partner-majority").date)).toBe("2031-07-14");
    // married + (married - dob).
    expect(ymd(byId(events, "married-longer").date)).toBe("2053-03-28");
    // dob + expectancy/2, expectancy = 78 + 1 + 0 + 1 = 80 -> +40y.
    expect(ymd(byId(events, "halfway").date)).toBe("2028-12-31");
    expect(ymd(byId(events, "expectancy-end").date)).toBe("2068-12-31");
    // Calendar-year child milestones land on the birthday.
    expect(ymd(byId(events, "child-peers").date)).toBe("2036-10-30");
    expect(ymd(byId(events, "child-18").date)).toBe("2041-10-30");
    expect(ymd(byId(events, "child-leaves").date)).toBe("2045-10-30");
    // dob + HALE 70.
    expect(ymd(byId(events, "healthy-years").date)).toBe("2059-01-01");
    // Dad is 68 today -> the author turns 68 on 2057-01-01.
    expect(ymd(byId(events, "parent-age-now").date)).toBe("2057-01-01");
  });

  it("dates the parent probability thresholds", () => {
    expect(ymd(byId(events, "parents-one-50").date)).toBe("2039-06-20");
    expect(ymd(byId(events, "parents-both-50").date)).toBe("2050-05-20");
    expect(ymd(byId(events, "parents-both-90").date)).toBe("2058-12-20");
  });

  it("keeps parent thresholds monotonic", () => {
    const one = byId(events, "parents-one-50").date.getTime();
    const both50 = byId(events, "parents-both-50").date.getTime();
    const both90 = byId(events, "parents-both-90").date.getTime();
    expect(one).toBeLessThanOrEqual(both50);
    expect(both50).toBeLessThanOrEqual(both90);
  });

  it("sorts ascending and never yields an invalid date", () => {
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].date.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].date.getTime(),
      );
    }
    for (const e of events) {
      expect(Number.isNaN(e.date.getTime())).toBe(false);
      if (e.rangeStart) expect(Number.isNaN(e.rangeStart.getTime())).toBe(false);
      if (e.rangeEnd) expect(Number.isNaN(e.rangeEnd.getTime())).toBe(false);
      if (e.rangeStart && e.rangeEnd) {
        expect(e.rangeEnd.getTime()).toBeGreaterThanOrEqual(e.rangeStart.getTime());
      }
    }
  });

  it("uses the supplied labels in first-person, natural-case copy", () => {
    expect(byId(events, "partner-majority").label).toContain("my wife");
    expect(byId(events, "child-18").label).toBe("My son turns 18");
    expect(byId(events, "parent-age-now").label).toBe("The age Dad is now");
    // First person, no shouting names.
    expect(byId(events, "met").detail).toBe(
      "The day I met my wife. Everything since is on this side of it.",
    );
    expect(byId(events, "child-leaves").detail).toMatch(/\d+% of our time/);
    for (const e of events) expect(e.detail).not.toMatch(/\byou\b|\byour\b/i);
  });

  it("keeps labels short and details substantial", () => {
    for (const e of events) {
      expect(e.label.length).toBeLessThanOrEqual(40);
      expect(e.detail.length).toBeGreaterThan(10);
      expect(e.basis.length).toBeGreaterThan(0);
    }
  });

  it("highlights married time from the wedding, not from birth", () => {
    const marriedLonger = byId(events, "married-longer");
    expect(marriedLonger.rangeStart?.toISOString()).toBe(
      new Date(2021, 1, 13).toISOString(),
    );
  });
});

describe("buildEvents — omission", () => {
  it("emits only dob-derived events for a bare profile", () => {
    expect(buildEvents(BARE, NOW).map((e) => e.id)).toEqual([
      "halfway",
      "healthy-years",
      "expectancy-end",
    ]);
  });

  it("omits the married pair when only `met` is present", () => {
    const ids = buildEvents(
      { ...BARE, people: { partnerMet: "2010-04-08" } },
      NOW,
    ).map((e) => e.id);
    expect(ids).toContain("met");
    expect(ids).toContain("partner-majority");
    expect(ids).not.toContain("married");
    expect(ids).not.toContain("married-longer");
  });

  it("omits the joint parent thresholds for a single parent", () => {
    const ids = buildEvents({ ...BARE, people: { parents: [DAD] } }, NOW).map(
      (e) => e.id,
    );
    expect(ids).toContain("parents-one-50");
    expect(ids).toContain("parent-age-now");
    expect(ids).not.toContain("parents-both-50");
    expect(ids).not.toContain("parents-both-90");
  });

  it("suffixes ids when there is more than one child", () => {
    const ids = buildEvents(
      {
        ...BARE,
        people: {
          children: [
            { label: "MY SON", dob: "2023-10-30" },
            { label: "MY DAUGHTER", dob: "2025-05-04" },
          ],
        },
      },
      NOW,
    ).map((e) => e.id);
    expect(ids).toContain("child-born-0");
    expect(ids).toContain("child-born-1");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns nothing for an unparseable dob", () => {
    expect(buildEvents({ ...BARE, dob: "not-a-date" }, NOW)).toEqual([]);
  });

  it("falls back to generic labels when none are supplied", () => {
    const events = buildEvents(
      { ...BARE, people: { partnerMet: "2010-04-08", children: [{ label: "", dob: "2023-10-30" }] } },
      NOW,
    );
    expect(byId(events, "partner-majority").label).toContain("my partner");
    expect(byId(events, "child-18").label).toBe("My child turns 18");
  });
});

describe("survivalProbability", () => {
  it("is 1 at or before now and decreasing after", () => {
    expect(survivalProbability(DAD, NOW, NOW)).toBe(1);
    expect(survivalProbability(DAD, new Date(2020, 0, 1), NOW)).toBe(1);
    const a = survivalProbability(DAD, new Date(2036, 6, 20), NOW);
    const b = survivalProbability(DAD, new Date(2046, 6, 20), NOW);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });

  it("lands a 68-year-old male's median remaining life at 16-18 years", () => {
    expect(medianRemaining(DAD, NOW)).toBeGreaterThanOrEqual(16);
    expect(medianRemaining(DAD, NOW)).toBeLessThanOrEqual(18);
  });

  it("lands a 67-year-old female's median remaining life at 20-22 years", () => {
    expect(medianRemaining(MUM, NOW)).toBeGreaterThanOrEqual(20);
    expect(medianRemaining(MUM, NOW)).toBeLessThanOrEqual(22);
  });

  it("gives women the longer curve at the same age", () => {
    const at = new Date(2046, 6, 20);
    const maleAt60: RelatedPerson = { label: "M", dob: "1966-07-20", sex: "male" };
    const femaleAt60: RelatedPerson = { label: "F", dob: "1966-07-20", sex: "female" };
    expect(survivalProbability(femaleAt60, at, NOW)).toBeGreaterThan(
      survivalProbability(maleAt60, at, NOW),
    );
  });

  it("returns 0 for an unparseable dob", () => {
    expect(survivalProbability({ label: "X", dob: "1958" }, new Date(2040, 0, 1), NOW)).toBe(0);
  });
});

describe("solveThresholdDate", () => {
  it("returns `from` when the target is already met", () => {
    const d = solveThresholdDate(() => 1, 0.5, NOW, 10);
    expect(d?.getTime()).toBe(NOW.getTime());
  });

  it("finds the first month crossing a rising target", () => {
    const p = (d: Date) => (d.getTime() - NOW.getTime()) / (10 * MS_PER_YEAR);
    const d = solveThresholdDate(p, 0.5, NOW, 20);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2031);
  });

  it("returns null when the target is never reached", () => {
    expect(solveThresholdDate(() => 0, 0.5, NOW, 5)).toBeNull();
  });
});

describe("EVENTS_DISCLAIMER", () => {
  it("stays honest and local", () => {
    expect(EVENTS_DISCLAIMER).toMatch(/browser/);
    expect(EVENTS_DISCLAIMER.length).toBeGreaterThan(80);
  });
});
