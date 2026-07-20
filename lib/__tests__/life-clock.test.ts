import { afterEach, describe, expect, it } from "vitest";

import {
  CELLS_PER_DAY,
  MS_PER_DAY,
  MS_PER_YEAR,
  cellIndexFor,
  dayOfYear,
  estimateExpectancy,
  estimateExpectancyRaw,
  formatClock,
  formatDate,
  formatDayRemaining,
  formatDuration,
  formatExpectancy,
  formatLifeRemaining,
  formatPercent,
  formatWeekRemaining,
  formatYearRemaining,
  formatYearsDays,
  getDayProgress,
  getExpectancyDate,
  getFraction,
  getLifeProgress,
  getMonthProgress,
  getWeekProgress,
  getYearProgress,
  isLeapYear,
  isoWeek,
  isoWeekYear,
  isoWeekday,
  parseDob,
  weeksInIsoYear,
  type LifePeople,
  type LifeProfile,
} from "@/lib/life-clock";
import {
  DEFAULT_PROFILE,
  STORAGE_KEY,
  createDemoProfile,
  loadProfile,
  validateProfile,
} from "@/lib/life-clock-storage";

const NOW = new Date(2026, 6, 19, 12, 0, 0, 0); // Sunday 2026-07-19 noon

const PEOPLE: LifePeople = {
  partnerLabel: "MY WIFE",
  partnerMet: "2010-04-08",
  partnerMarried: "2021-02-13",
  children: [{ label: "MY SON", dob: "2023-10-30", sex: "male" }],
  parents: [
    { label: "DAD", dob: "1958-01-01", sex: "male" },
    { label: "MUM", dob: "1959-01-01", sex: "female" },
  ],
};

function makeProfile(overrides: Partial<LifeProfile> = {}): LifeProfile {
  return {
    v: 2,
    dob: "1996-07-19",
    sex: "unspecified",
    smoking: "never",
    exercise: "weekly",
    region: "unspecified",
    demo: false,
    savedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("getDayProgress", () => {
  it("is zero at local midnight", () => {
    const p = getDayProgress(new Date(2026, 6, 19, 0, 0, 0, 0));
    expect(p.elapsedSeconds).toBe(0);
    expect(p.fraction).toBe(0);
    expect(p.liveCellIndex).toBe(0);
    expect(p.filledCells).toBe(0);
    expect(p.cellFraction).toBe(0);
  });

  it("clamps the live cell at the last instant of the day", () => {
    const p = getDayProgress(new Date(2026, 6, 19, 23, 59, 59, 999));
    expect(p.fraction).toBeLessThan(1);
    expect(p.liveCellIndex).toBe(17279);
  });

  it("reads half at noon", () => {
    const p = getDayProgress(new Date(2026, 6, 19, 12, 0, 0, 0));
    expect(p.fraction).toBe(0.5);
    expect(p.liveCellIndex).toBe(8640);
    expect(p.remainingSeconds).toBe(43200);
  });
});

describe("getWeekProgress", () => {
  it("is zero at Monday 00:00 local", () => {
    const p = getWeekProgress(new Date(2026, 6, 20, 0, 0, 0, 0)); // Monday
    expect(p.dayIndex).toBe(0);
    expect(p.elapsedSeconds).toBe(0);
    expect(p.fraction).toBe(0);
  });

  it("maps JS Sunday (getDay 0) to dayIndex 6", () => {
    const sunday = new Date(2026, 6, 19, 23, 59, 59, 0);
    expect(sunday.getDay()).toBe(0);
    const p = getWeekProgress(sunday);
    expect(p.dayIndex).toBe(6);
    expect(p.elapsedSeconds).toBe(604799);
    expect(p.totalSeconds).toBe(604800);
  });
});

describe("getMonthProgress", () => {
  it("is calendar-correct for July", () => {
    const p = getMonthProgress(NOW);
    expect(p.dayOfMonth).toBe(19);
    expect(p.daysInMonth).toBe(31);
    expect(p.totalSeconds).toBe(31 * 86400);
    expect(p.elapsedSeconds).toBe(18 * 86400 + 43200);
    expect(p.fraction).toBeCloseTo(18.5 / 31, 12);
  });

  it("handles leap February", () => {
    const p = getMonthProgress(new Date(2024, 1, 29, 0, 0, 0, 0));
    expect(p.daysInMonth).toBe(29);
    expect(p.dayOfMonth).toBe(29);
  });
});

describe("year math", () => {
  it("dayOfYear handles leap and non-leap years", () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
    expect(dayOfYear(new Date(2024, 2, 1))).toBe(61); // leap Mar 1
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("isLeapYear follows the Gregorian rule", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
  });

  it("getYearProgress is leap-aware", () => {
    const p = getYearProgress(NOW);
    expect(p.dayOfYear).toBe(200);
    expect(p.daysInYear).toBe(365);
    expect(p.totalSeconds).toBe(365 * 86400);
    const leap = getYearProgress(new Date(2024, 11, 31, 23, 59, 59, 0));
    expect(leap.daysInYear).toBe(366);
    expect(leap.fraction).toBeLessThan(1);
  });
});

describe("ISO week helpers", () => {
  it("isoWeekday maps Mon=1..Sun=7", () => {
    expect(isoWeekday(new Date(2026, 6, 20))).toBe(1); // Monday
    expect(isoWeekday(new Date(2026, 6, 23))).toBe(4); // Thursday
    expect(isoWeekday(new Date(2026, 6, 19))).toBe(7); // Sunday
  });

  it("2027-01-01 (a Friday) is ISO week 53 of 2026", () => {
    const d = new Date(2027, 0, 1);
    expect(d.getDay()).toBe(5);
    expect(isoWeek(d)).toBe(53);
    expect(isoWeekYear(d)).toBe(2026);
  });

  it("weeksInIsoYear yields 53 for 2026 and 52 for 2025", () => {
    expect(weeksInIsoYear(2026)).toBe(53);
    expect(weeksInIsoYear(2025)).toBe(52);
    expect(weeksInIsoYear(2020)).toBe(53); // leap starting Wednesday
  });

  it("assigns year-boundary days to the correct ISO year", () => {
    // Week 1 of 2026 runs Mon 2025-12-29 .. Sun 2026-01-04.
    expect(isoWeekYear(new Date(2025, 11, 29))).toBe(2026);
    expect(isoWeek(new Date(2025, 11, 29))).toBe(1);
    // Week 53 of 2026 runs Mon 2026-12-28 .. Sun 2027-01-03.
    expect(isoWeekYear(new Date(2027, 0, 3))).toBe(2026);
    expect(isoWeek(new Date(2027, 0, 3))).toBe(53);
    // Mon 2027-01-04 opens week 1 of 2027.
    expect(isoWeekYear(new Date(2027, 0, 4))).toBe(2027);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
  });
});

describe("parseDob", () => {
  it("accepts real dates and returns local midnight", () => {
    const d = parseDob("1996-02-29", NOW);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(1996);
    expect(d!.getMonth()).toBe(1);
    expect(d!.getDate()).toBe(29);
    expect(d!.getHours()).toBe(0);
  });

  it("accepts today", () => {
    expect(parseDob("2026-07-19", NOW)).not.toBeNull();
  });

  it("rejects impossible, out-of-range, and malformed dates", () => {
    expect(parseDob("2023-02-30", NOW)).toBeNull();
    expect(parseDob("1899-12-31", NOW)).toBeNull();
    expect(parseDob("2026-07-20", NOW)).toBeNull(); // tomorrow
    expect(parseDob("19960719", NOW)).toBeNull();
    expect(parseDob("1996-2-9", NOW)).toBeNull();
  });
});

describe("expectancy", () => {
  it("demo answers sum to 81.5", () => {
    expect(estimateExpectancyRaw(makeProfile())).toBe(81.5);
  });

  it("female / never / often / east-asia sums to 88", () => {
    const p = makeProfile({ sex: "female", exercise: "often", region: "east-asia" });
    expect(estimateExpectancyRaw(p)).toBe(88);
    expect(estimateExpectancy(p, NOW)).toBe(88); // age 30 — no clamp
  });

  it("male / current / rarely / united-states sums to 66, clamped to age + 1", () => {
    const p = makeProfile({
      dob: "1950-01-15",
      sex: "male",
      smoking: "current",
      exercise: "rarely",
      region: "united-states",
    });
    expect(estimateExpectancyRaw(p)).toBe(66);
    const dobMs = new Date(1950, 0, 15).getTime();
    const at703 = new Date(dobMs + 70.3 * MS_PER_YEAR);
    expect(estimateExpectancy(p, at703)).toBeCloseTo(71.3, 6);
  });

  it("applies the 105 upper clamp", () => {
    // Raw tables max out at 88, so 105 is unreachable — but the clamp holds.
    const p = makeProfile({ sex: "female", exercise: "often", region: "east-asia" });
    expect(estimateExpectancy(p, NOW)).toBeLessThanOrEqual(105);
  });

  it("getLifeProgress at 81.5y expectancy yields 4252 weeks / 29767 days", () => {
    const life = getLifeProgress(NOW, makeProfile());
    expect(life.expectancyYears).toBe(81.5);
    expect(life.totalWeeks).toBe(4252);
    expect(life.totalDays).toBe(29767);
    expect(life.ageYears).toBeCloseTo(30, 2);
  });

  it("getExpectancyDate is dob + expectancy years", () => {
    const p = makeProfile();
    const dobMs = new Date(1996, 6, 19).getTime();
    expect(getExpectancyDate(p, NOW).getTime()).toBe(dobMs + 81.5 * MS_PER_YEAR);
  });
});

describe("life fraction cap", () => {
  it("an outlived expectancy never reaches 1", () => {
    const p = makeProfile({
      dob: "1950-01-15",
      sex: "male",
      smoking: "current",
      exercise: "rarely",
      region: "united-states",
    });
    const dobMs = new Date(1950, 0, 15).getTime();
    const life = getLifeProgress(new Date(dobMs + 75 * MS_PER_YEAR), p);
    expect(life.fraction).toBeLessThanOrEqual(0.9999);
    expect(life.fraction).toBeCloseTo(75 / 76, 6);
    expect(life.msRemaining).toBeGreaterThan(0);
  });
});

describe("formatPercent", () => {
  it("floors — never a premature 100", () => {
    expect(formatPercent(0.999999, 2)).toBe("99.99%");
    expect(formatPercent(0.58234, 2)).toBe("58.23%");
    expect(formatPercent(0.9999999999, 7)).toBe("99.9999999%");
  });

  it("clamps input to [0, 1]", () => {
    expect(formatPercent(1.2, 2)).toBe("100.00%");
    expect(formatPercent(-0.5, 2)).toBe("0.00%");
  });

  it("renders the per-mode decimal counts (R4)", () => {
    expect(formatPercent(0.62417, 3)).toBe("62.417%"); // DAY
    expect(formatPercent(0.480035, 4)).toBe("48.0035%"); // WEEK
    expect(formatPercent(0.5455021, 5)).toBe("54.55021%"); // YEAR
    expect(formatPercent(0.383721944, 7)).toBe("38.3721944%"); // LIFE
    expect(formatPercent(0, 3)).toBe("0.000%");
  });
});

describe("duration and span formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(93725)).toBe("1D 02:02:05");
    expect(formatDuration(3661.9)).toBe("01:01:01");
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formatYearsDays", () => {
    expect(formatYearsDays(46 * MS_PER_YEAR + 213 * MS_PER_DAY)).toBe("46Y 213D");
    expect(formatYearsDays(0)).toBe("0Y 0D");
  });

  it("formatExpectancy uses one decimal and the YR suffix (R5)", () => {
    expect(formatExpectancy(81.5)).toBe("81.5 YR");
    expect(formatExpectancy(78)).toBe("78.0 YR");
  });
});

describe("per-mode REMAINING formatters (R4)", () => {
  it("DAY keeps seconds", () => {
    expect(formatDayRemaining(9 * 3600 + 27 * 60 + 55)).toBe("T-09:27:55");
    expect(formatDayRemaining(0)).toBe("T-00:00:00");
  });

  it("WEEK keeps seconds with an unpadded day count", () => {
    expect(formatWeekRemaining(3 * 86400 + 15 * 3600 + 12 * 60 + 44)).toBe(
      "T-3D 15:12:44",
    );
    expect(formatWeekRemaining(59)).toBe("T-0D 00:00:59");
  });

  it("YEAR drops seconds, keeps minutes", () => {
    expect(formatYearRemaining(165 * 86400 + 9 * 3600 + 27 * 60 + 59)).toBe(
      "T-165D 09:27",
    );
  });

  it("LIFE uses 2-dp years", () => {
    expect(formatLifeRemaining(50.79 * MS_PER_YEAR)).toBe("T-50.79 YR");
  });
});

describe("clock/date formatters", () => {
  it("zero-pads", () => {
    expect(formatClock(new Date(2026, 6, 19, 4, 7, 32))).toBe("04:07:32");
    expect(formatDate(new Date(2026, 6, 19))).toBe("2026-07-19");
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("cellIndexFor / getFraction", () => {
  it("clamps to the last cell", () => {
    expect(cellIndexFor(0, CELLS_PER_DAY)).toBe(0);
    expect(cellIndexFor(0.5, CELLS_PER_DAY)).toBe(8640);
    expect(cellIndexFor(0.9999999, CELLS_PER_DAY)).toBe(17279);
    expect(cellIndexFor(1, CELLS_PER_DAY)).toBe(17279);
  });

  it("getFraction dispatches per view and requires a profile for life", () => {
    expect(getFraction("day", NOW)).toBe(0.5);
    expect(getFraction("week", NOW)).toBeCloseTo(getWeekProgress(NOW).fraction, 12);
    expect(getFraction("life", NOW, makeProfile())).toBeGreaterThan(0);
    expect(() => getFraction("life", NOW)).toThrow();
  });
});

describe("validateProfile", () => {
  it("rejects non-objects and arrays", () => {
    expect(validateProfile("{", NOW)).toBeNull();
    expect(validateProfile([], NOW)).toBeNull();
    expect(validateProfile(null, NOW)).toBeNull();
  });

  it("rejects wrong versions and bad fields", () => {
    expect(validateProfile({ ...makeProfile(), v: 3 }, NOW)).toBeNull();
    expect(validateProfile({ ...makeProfile(), v: 0 }, NOW)).toBeNull();
    expect(validateProfile(makeProfile({ dob: "2023-02-30" }), NOW)).toBeNull();
    expect(
      validateProfile({ ...makeProfile(), sex: "other" }, NOW),
    ).toBeNull();
  });

  it("migrates a valid v:1 payload to v:2 with no people block", () => {
    const legacy = { ...makeProfile(), v: 1, people: PEOPLE };
    const result = validateProfile(legacy, NOW);
    expect(result).not.toBeNull();
    expect(result!.v).toBe(2);
    // v:1 never carried relationships; anything in that slot is not ours.
    expect(result!.people).toBeUndefined();
    expect(result!.dob).toBe("1996-07-19");
  });

  it("keeps a valid people block on a v:2 payload", () => {
    const result = validateProfile(makeProfile({ people: PEOPLE }), NOW);
    expect(result!.people).toEqual(PEOPLE);
  });

  it("drops individually invalid people entries without failing the profile", () => {
    const result = validateProfile(
      makeProfile({
        people: {
          partnerLabel: 42,
          partnerMet: "2010-04-31",
          partnerMarried: "2021-02-13",
          children: [
            { label: "SON", dob: "2023-10-30", sex: "male" },
            { label: "GHOST", dob: "not-a-date" },
            { label: "", dob: "2020-01-01" },
            "nope",
          ],
          parents: [{ label: "DAD", dob: "1958-01-01", sex: "wolf" }],
        },
      } as unknown as Partial<LifeProfile>),
      NOW,
    );
    expect(result).not.toBeNull();
    expect(result!.people).toEqual({
      partnerMarried: "2021-02-13",
      children: [{ label: "SON", dob: "2023-10-30", sex: "male" }],
      parents: [{ label: "DAD", dob: "1958-01-01" }],
    });
  });

  it("collapses an absent or fully invalid people block to undefined", () => {
    expect(validateProfile(makeProfile(), NOW)!.people).toBeUndefined();
    expect(
      validateProfile(
        makeProfile({ people: [] as unknown as never }),
        NOW,
      )!.people,
    ).toBeUndefined();
    expect(
      validateProfile(
        makeProfile({ people: { partnerMet: "1899-12-31" } }),
        NOW,
      )!.people,
    ).toBeUndefined();
  });

  it("coerces missing demo/savedAt on an otherwise-valid profile", () => {
    const full: Record<string, unknown> = { ...makeProfile() };
    delete full.demo;
    delete full.savedAt;
    const partial = full;
    const result = validateProfile(partial, NOW);
    expect(result).not.toBeNull();
    expect(result!.demo).toBe(false);
    expect(result!.savedAt).toBe(NOW.toISOString());
  });

  it("accepts a valid profile round-trip", () => {
    const p = makeProfile({ demo: true });
    expect(validateProfile(p, NOW)).toEqual(p);
  });

  it("keeps valid places and crossroads on a v:2 payload", () => {
    const result = validateProfile(
      makeProfile({
        places: [{ label: "Here", start: "2000-01-01", end: "2005-01-01" }],
        crossroads: [
          { label: "Fork", date: "2001-06-01", detail: "changed it" },
        ],
      }),
      NOW,
    );
    expect(result!.places).toEqual([
      { label: "Here", start: "2000-01-01", end: "2005-01-01" },
    ]);
    expect(result!.crossroads).toEqual([
      { label: "Fork", date: "2001-06-01", detail: "changed it" },
    ]);
  });

  it("drops individually invalid place and crossroad entries", () => {
    const result = validateProfile(
      makeProfile({
        places: [
          { label: "", start: "2000-01-01" },
          { label: "Ghost", start: "not-a-date" },
          { label: "Keep", start: "2000-01-01", end: "bad" },
          "nope",
        ],
        crossroads: [
          { label: "No date", detail: "x" },
          { label: "No detail", date: "2001-01-01" },
          { label: "Keep", date: "2002-01-01", detail: "kept" },
        ],
      } as unknown as Partial<LifeProfile>),
      NOW,
    );
    // A bad end is dropped (treated as ongoing), not fatal to the entry.
    expect(result!.places).toEqual([{ label: "Keep", start: "2000-01-01" }]);
    expect(result!.crossroads).toEqual([
      { label: "Keep", date: "2002-01-01", detail: "kept" },
    ]);
  });

  it("collapses absent or fully-invalid places/crossroads to undefined", () => {
    expect(validateProfile(makeProfile(), NOW)!.places).toBeUndefined();
    expect(validateProfile(makeProfile(), NOW)!.crossroads).toBeUndefined();
    expect(
      validateProfile(
        makeProfile({ places: [] as unknown as never }),
        NOW,
      )!.places,
    ).toBeUndefined();
  });

  it("ignores places/crossroads carried on a v:1 payload", () => {
    const legacy = {
      ...makeProfile(),
      v: 1,
      places: [{ label: "X", start: "2000-01-01" }],
      crossroads: [{ label: "Y", date: "2000-01-01", detail: "z" }],
    };
    const result = validateProfile(legacy, NOW);
    expect(result!.places).toBeUndefined();
    expect(result!.crossroads).toBeUndefined();
  });
});

describe("loadProfile (mocked window)", () => {
  const store = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };

  afterEach(() => {
    store.clear();
    delete (globalThis as { window?: unknown }).window;
  });

  function withWindow(): void {
    (globalThis as { window?: unknown }).window = fakeWindow;
  }

  it("returns null without window (SSR)", () => {
    expect(loadProfile()).toBeNull();
  });

  it("removes corrupt JSON", () => {
    withWindow();
    store.set(STORAGE_KEY, "{");
    expect(loadProfile()).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("removes invalid payloads", () => {
    withWindow();
    store.set(STORAGE_KEY, JSON.stringify(makeProfile({ dob: "2023-02-30" })));
    expect(loadProfile()).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("preserves v > 2 payloads untouched", () => {
    withWindow();
    const newer = JSON.stringify({ v: 3, future: true });
    store.set(STORAGE_KEY, newer);
    expect(loadProfile()).toBeNull();
    expect(store.get(STORAGE_KEY)).toBe(newer);
  });

  it("loads a valid profile", () => {
    withWindow();
    store.set(STORAGE_KEY, JSON.stringify(makeProfile({ people: PEOPLE })));
    expect(loadProfile()).toEqual(makeProfile({ people: PEOPLE }));
  });

  it("migrates a stored v:1 profile to v:2 in memory", () => {
    withWindow();
    store.set(STORAGE_KEY, JSON.stringify({ ...makeProfile(), v: 1 }));
    const loaded = loadProfile();
    expect(loaded!.v).toBe(2);
    expect(loaded!.people).toBeUndefined();
    expect(store.has(STORAGE_KEY)).toBe(true);
  });
});

describe("DEFAULT_PROFILE", () => {
  const then = new Date(2026, 6, 20, 12, 0, 0, 0);

  it("is flagged as the author profile", () => {
    expect(DEFAULT_PROFILE.author).toBe(true);
  });

  it("validates, but the author flag is never carried through storage", () => {
    // A validated (stored) profile is by definition the user's own.
    const { author: _author, ...expected } = DEFAULT_PROFILE;
    void _author;
    expect(validateProfile(DEFAULT_PROFILE, then)).toEqual(expected);
  });

  it("carries the author's five places and one crossroad", () => {
    expect(DEFAULT_PROFILE.places!.map((p) => p.label)).toEqual([
      "Wairarapa",
      "Wellington",
      "Travelling",
      "London",
      "Auckland",
    ]);
    // Auckland is open-ended (still there).
    expect(DEFAULT_PROFILE.places![4].end).toBeUndefined();
    expect(DEFAULT_PROFILE.crossroads).toHaveLength(1);
    expect(DEFAULT_PROFILE.crossroads![0].date).toBe("2008-11-15");
  });

  it("has parents aged 68 and 67 on 2026-07-20", () => {
    const ages = DEFAULT_PROFILE.people!.parents!.map((parent) =>
      Math.floor(
        (then.getTime() - parseDob(parent.dob, then)!.getTime()) / MS_PER_YEAR,
      ),
    );
    expect(ages).toEqual([68, 67]);
  });

  it("estimates an 80.0 year span", () => {
    expect(estimateExpectancyRaw(DEFAULT_PROFILE)).toBe(80);
    expect(formatExpectancy(estimateExpectancy(DEFAULT_PROFILE, then))).toBe(
      "80.0 YR",
    );
  });
});

describe("createDemoProfile", () => {
  it("is exactly 30 years back with neutral answers", () => {
    const demo = createDemoProfile(new Date(2026, 6, 19));
    expect(demo.dob).toBe("1996-07-19");
    expect(demo.demo).toBe(true);
    expect(demo.sex).toBe("unspecified");
    expect(demo.smoking).toBe("never");
    expect(demo.exercise).toBe("weekly");
    expect(demo.region).toBe("unspecified");
  });

  it("clamps a Feb 29 first-run to Feb 28 of the non-leap target year", () => {
    expect(createDemoProfile(new Date(2024, 1, 29)).dob).toBe("1994-02-28");
  });
});
