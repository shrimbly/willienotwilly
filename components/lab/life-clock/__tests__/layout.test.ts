import { describe, expect, it } from "vitest";

import {
  CELL_ASPECT_MAX,
  CELL_ASPECT_MIN,
  buildLayout,
  childOpacity,
  computeMorphEnvelope,
  computeMorphTransforms,
  parentOpacity,
  slotInteriorOpacity,
  slotOutlineOpacity,
  transformRect,
} from "@/components/lab/life-clock/layout";
import type { Rect, ViewLayout } from "@/components/lab/life-clock/types";
import {
  VIEW_DAY,
  VIEW_LIFE,
  VIEW_WEEK,
  VIEW_YEAR,
} from "@/components/lab/life-clock/types";
import type { LifeProfile } from "@/lib/life-clock";
import {
  MS_PER_WEEK,
  getExpectancyDate,
  isoWeek,
  isoWeekYear,
  isoWeekday,
  parseDob,
  weeksInIsoYear,
} from "@/lib/life-clock";

const AREA: Rect = { x: 0, y: 0, w: 1600, h: 900 };

// Thursday 2026-07-16, noon — mid ISO week 29 of the 53-week ISO year 2026.
const NOW = new Date(2026, 6, 16, 12, 0, 0, 0);

// Demo-equivalent profile: expectancy 80.5 + 1 (weekly exercise) = 81.5.
const PROFILE: LifeProfile = {
  v: 2,
  dob: "1996-07-19",
  sex: "unspecified",
  smoking: "never",
  exercise: "weekly",
  region: "unspecified",
  demo: false,
  savedAt: "2026-07-16T00:00:00.000Z",
};

function build(view: 0 | 1 | 2 | 3, area: Rect = AREA, now: Date = NOW) {
  return buildLayout({ view, gridArea: area, now, profile: PROFILE });
}

// Cell rects round-trip through a Float32Array; ~1e-4 px of quantization is
// expected at 4-digit coordinates. Still far below the 0.5px seam budget.
const F32_EPS = 1e-3;

function expectRectClose(a: Rect, b: Rect, eps: number) {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
  expect(Math.abs(a.w - b.w)).toBeLessThan(eps);
  expect(Math.abs(a.h - b.h)).toBeLessThan(eps);
}

/** Bounding box of a contiguous index range of cells. */
function unionRect(layout: ViewLayout, from: number, to: number): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = from; i <= to; i++) {
    const r = layout.cellRect(i);
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

describe("fixture sanity", () => {
  it("NOW is a Thursday in ISO week 29 of the 53-week ISO year 2026", () => {
    expect(NOW.getDay()).toBe(4);
    expect(isoWeekday(NOW)).toBe(4);
    expect(isoWeek(NOW)).toBe(29);
    expect(isoWeekYear(NOW)).toBe(2026);
    expect(weeksInIsoYear(2026)).toBe(53);
    expect(weeksInIsoYear(2025)).toBe(52);
  });
});

describe("cell counts", () => {
  it("DAY has 17,280 cells", () => {
    expect(build(VIEW_DAY).cellCount).toBe(17_280);
  });

  it("WEEK has 10,080 cells", () => {
    expect(build(VIEW_WEEK).cellCount).toBe(10_080);
  });

  it("YEAR has 7 × weeksInIsoYear cells (364–371)", () => {
    const y2026 = build(VIEW_YEAR);
    expect(y2026.cellCount).toBe(7 * weeksInIsoYear(2026));
    expect(y2026.cellCount).toBe(371);

    const now2025 = new Date(2025, 6, 16, 12, 0, 0);
    const y2025 = build(VIEW_YEAR, AREA, now2025);
    expect(y2025.cellCount).toBe(7 * weeksInIsoYear(2025));
    expect(y2025.cellCount).toBe(364);
    expect(y2025.cellCount).toBeGreaterThanOrEqual(364);
    expect(y2026.cellCount).toBeLessThanOrEqual(371);
  });

  it("LIFE real-cell count equals the ISO week span dob→expectancy (ghosts excluded)", () => {
    const life = build(VIEW_LIFE);
    const dob = parseDob(PROFILE.dob, NOW);
    expect(dob).not.toBeNull();
    if (!dob) return;
    const expectancy = getExpectancyDate(PROFILE, NOW);
    // Independent count: distinct ISO weeks from dob's week through the
    // expectancy week, via Monday alignment.
    const mondayOf = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate() - (isoWeekday(d) - 1));
    const expected =
      Math.round(
        (mondayOf(expectancy).getTime() - mondayOf(dob).getTime()) / MS_PER_WEEK,
      ) + 1;
    expect(life.cellCount).toBe(expected);
    // Strictly fewer than a full 53-column block — ghosts are not instanced.
    const yearRows = isoWeekYear(expectancy) - isoWeekYear(dob) + 1;
    expect(life.cellCount).toBeLessThan(yearRows * 53);
  });

  it("LIFE expectancy cell is the final instanced cell", () => {
    const life = build(VIEW_LIFE);
    expect(life.expectancyIndex).toBe(life.cellCount - 1);
  });
});

describe("DAY row semantics (landscape row = 15 minutes)", () => {
  const day = build(VIEW_DAY);

  it("cell index 180 lands at row 1, col 0", () => {
    const r = day.cellRect(180);
    expect(Math.abs(r.x - day.gridRect.x)).toBeLessThan(F32_EPS);
    expect(Math.abs(r.y - (day.gridRect.y + day.cellH))).toBeLessThan(F32_EPS);
  });

  it("hour-band gutter appears after row 4 (index 720 at 4.5 row-units)", () => {
    const r = day.cellRect(720);
    expect(
      Math.abs(r.y - (day.gridRect.y + 4.5 * day.cellH)),
    ).toBeLessThan(F32_EPS);
  });

  it("minute column gutters: cell 179 sits at 182.5 col-units", () => {
    const r = day.cellRect(179);
    expect(
      Math.abs(r.x - (day.gridRect.x + 182.5 * day.cellW)),
    ).toBeLessThan(F32_EPS);
  });

  it("liveState: noon = index 8640, frac 0; end of day clamps to 17279", () => {
    expect(day.liveState(NOW)).toEqual({ index: 8640, frac: 0, filled: 8640 });
    const end = day.liveState(new Date(2026, 6, 16, 23, 59, 59, 999));
    expect(end.index).toBe(17_279);
    expect(end.frac).toBeLessThan(1);
  });
});

describe("aspect-fit clamp", () => {
  it("in-clamp layouts fill both axes exactly (1600×900 DAY)", () => {
    const day = build(VIEW_DAY);
    expectRectClose(day.gridRect, AREA, 1e-6);
    const aspect = day.cellW / day.cellH;
    expect(aspect).toBeGreaterThanOrEqual(CELL_ASPECT_MIN);
    expect(aspect).toBeLessThanOrEqual(CELL_ASPECT_MAX);
  });

  it("over-wide areas clamp cell aspect to the max and letterbox horizontally", () => {
    const area: Rect = { x: 0, y: 0, w: 4000, h: 500 };
    const day = build(VIEW_DAY, area);
    expect(day.cellW / day.cellH).toBeCloseTo(CELL_ASPECT_MAX, 9);
    expect(Math.abs(day.gridRect.h - 500)).toBeLessThan(1e-6);
    expect(day.gridRect.w).toBeLessThan(4000);
    expect(
      Math.abs(day.gridRect.x - (4000 - day.gridRect.w) / 2),
    ).toBeLessThan(1e-6);
  });

  it("over-tall areas clamp cell aspect to the min and letterbox vertically", () => {
    const area: Rect = { x: 0, y: 0, w: 500, h: 2000 };
    const day = build(VIEW_DAY, area);
    expect(day.cellW / day.cellH).toBeCloseTo(CELL_ASPECT_MIN, 9);
    expect(Math.abs(day.gridRect.w - 500)).toBeLessThan(1e-6);
    expect(day.gridRect.h).toBeLessThan(2000);
    expect(
      Math.abs(day.gridRect.y - (2000 - day.gridRect.h) / 2),
    ).toBeLessThan(1e-6);
  });
});

describe("worked example: 1600×900 DAY→WEEK (design-interaction §4.1)", () => {
  const day = build(VIEW_DAY);
  const week = build(VIEW_WEEK);

  it("WEEK-L cell is ~14.0 × 8.37 px", () => {
    expect(week.cellW).toBeCloseTo(1600 / 114, 3);
    expect(week.cellH).toBeCloseTo(900 / 107.5, 3);
  });

  it("Thursday slot spans ~693→904 px at full height", () => {
    const slot = week.slotRect;
    expect(slot).not.toBeNull();
    if (!slot) return;
    expect(Math.abs(slot.x - 49.5 * week.cellW)).toBeLessThan(1e-6);
    expect(Math.abs(slot.x - 693)).toBeLessThan(3);
    expect(Math.abs(slot.w - 211)).toBeLessThan(1);
    expect(Math.abs(slot.y - week.gridRect.y)).toBeLessThan(1e-6);
    expect(Math.abs(slot.h - 900)).toBeLessThan(1e-6);
  });

  it("camera at p=0 scales x by ~7.6 and y by exactly 1", () => {
    const { parent } = computeMorphTransforms(day, week, AREA, 0);
    expect(parent.scaleX).toBeCloseTo(7.6, 1);
    expect(parent.scaleY).toBeCloseTo(1, 9);
  });

  it("child at p=0 renders pixel-identical to its at-rest layout (<0.5px)", () => {
    const { child } = computeMorphTransforms(day, week, AREA, 0);
    for (const index of [0, 180, 5000, 8640, 17_279]) {
      const atRest = day.cellRect(index);
      const mapped = transformRect(child, atRest);
      expectRectClose(mapped, atRest, 0.5);
    }
  });

  it("parent at p=1 is the identity", () => {
    const { parent } = computeMorphTransforms(day, week, AREA, 1);
    expect(parent.scaleX).toBeCloseTo(1, 9);
    expect(parent.scaleY).toBeCloseTo(1, 9);
    expect(parent.offsetX).toBeCloseTo(0, 6);
    expect(parent.offsetY).toBeCloseTo(0, 6);
  });

  it("DAY↔WEEK has zero vertical cell motion (shared row-units)", () => {
    const { child } = computeMorphTransforms(day, week, AREA, 1);
    // Fully squashed into the slot: y mapping stays the identity.
    expect(child.scaleY).toBeCloseTo(1, 9);
    expect(child.offsetY).toBeCloseTo(0, 6);
  });
});

describe("slot rects: contiguity + equality with morph destination", () => {
  it("WEEK slot equals the bounding box of today's 1440 band cells", () => {
    const week = build(VIEW_WEEK);
    const d = (NOW.getDay() + 6) % 7;
    const band = unionRect(week, d * 1440, d * 1440 + 1439);
    expect(week.slotRect).not.toBeNull();
    if (!week.slotRect) return;
    expectRectClose(band, week.slotRect, 0.01);
  });

  it("YEAR slot equals the current week's contiguous 7-cell run", () => {
    const year = build(VIEW_YEAR);
    const w = isoWeek(NOW) - 1;
    const run = unionRect(year, w * 7, w * 7 + 6);
    expect(year.slotRect).not.toBeNull();
    if (!year.slotRect) return;
    expectRectClose(run, year.slotRect, 0.01);
    // Contiguous: consecutive cells advance by exactly one cell pitch.
    for (let k = 1; k < 7; k++) {
      const prev = year.cellRect(w * 7 + k - 1);
      const cur = year.cellRect(w * 7 + k);
      expect(Math.abs(cur.x - (prev.x + year.cellW))).toBeLessThan(F32_EPS);
      expect(Math.abs(cur.y - prev.y)).toBeLessThan(F32_EPS);
    }
  });

  it("LIFE slot equals the current year's contiguous row segment", () => {
    const life = build(VIEW_LIFE);
    const slot = life.slotRect;
    expect(slot).not.toBeNull();
    if (!slot) return;
    // Collect the row's cells by geometry (same y, x within the slot).
    const inRow: Rect[] = [];
    for (let i = 0; i < life.cellCount; i++) {
      const r = life.cellRect(i);
      if (
        Math.abs(r.y - slot.y) < F32_EPS &&
        r.x > slot.x - F32_EPS &&
        r.x + r.w < slot.x + slot.w + F32_EPS
      ) {
        inRow.push(r);
      }
    }
    expect(inRow.length).toBe(Math.round(slot.w / life.cellW));
    inRow.sort((a, b) => a.x - b.x);
    expect(Math.abs(inRow[0].x - slot.x)).toBeLessThan(F32_EPS);
    for (let k = 1; k < inRow.length; k++) {
      expect(
        Math.abs(inRow[k].x - (inRow[k - 1].x + life.cellW)),
      ).toBeLessThan(F32_EPS);
    }
  });

  it("child grid maps exactly onto the parent slot at p=1, at every rung", () => {
    const day = build(VIEW_DAY);
    const week = build(VIEW_WEEK);
    const year = build(VIEW_YEAR);
    const life = build(VIEW_LIFE);
    const pairs: Array<[ViewLayout, ViewLayout]> = [
      [day, week],
      [week, year],
      [year, life],
    ];
    for (const [child, parent] of pairs) {
      const { child: t } = computeMorphTransforms(child, parent, AREA, 1);
      expect(parent.slotRect).not.toBeNull();
      if (!parent.slotRect) continue;
      expectRectClose(transformRect(t, child.gridRect), parent.slotRect, 1e-6);
    }
  });

  it("child at p=0 is identity at every rung (no seam)", () => {
    const day = build(VIEW_DAY);
    const week = build(VIEW_WEEK);
    const year = build(VIEW_YEAR);
    const life = build(VIEW_LIFE);
    const pairs: Array<[ViewLayout, ViewLayout]> = [
      [day, week],
      [week, year],
      [year, life],
    ];
    for (const [child, parent] of pairs) {
      const { child: t } = computeMorphTransforms(child, parent, AREA, 0);
      const sample = Math.floor(child.cellCount / 2);
      const atRest = child.cellRect(sample);
      expectRectClose(transformRect(t, atRest), atRest, 0.5);
    }
  });
});

describe("liveState across views", () => {
  it("WEEK: Thursday noon = index 5040", () => {
    const week = build(VIEW_WEEK);
    expect(week.liveState(NOW)).toEqual({ index: 5040, frac: 0, filled: 5040 });
  });

  it("YEAR: Thursday of week 29 = index 199, frac 0.5 at noon", () => {
    const year = build(VIEW_YEAR);
    const live = year.liveState(NOW);
    expect(live.index).toBe(28 * 7 + 3);
    expect(live.frac).toBeCloseTo(0.5, 9);
    expect(live.filled).toBe(live.index);
  });

  it("LIFE: live index matches the dob-anchored week walk; frac mid-week", () => {
    const life = build(VIEW_LIFE);
    const dob = parseDob(PROFILE.dob, NOW);
    expect(dob).not.toBeNull();
    if (!dob) return;
    const mondayOf = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate() - (isoWeekday(d) - 1));
    const expectedIndex = Math.round(
      (mondayOf(NOW).getTime() - mondayOf(dob).getTime()) / MS_PER_WEEK,
    );
    const live = life.liveState(NOW);
    expect(live.index).toBe(expectedIndex);
    expect(live.frac).toBeCloseTo((3 + 0.5) / 7, 9);
  });
});

describe("LIFE ghost cells", () => {
  it("portrait: first instanced cell starts at the birth week column", () => {
    const area: Rect = { x: 0, y: 0, w: 600, h: 1200 };
    const life = build(VIEW_LIFE, area);
    const dob = parseDob(PROFILE.dob, NOW);
    expect(dob).not.toBeNull();
    if (!dob) return;
    const dobCol = isoWeek(dob) - 1;
    const first = life.cellRect(0);
    expect(
      Math.abs(first.x - (life.gridRect.x + dobCol * life.cellW)),
    ).toBeLessThan(F32_EPS);
    expect(Math.abs(first.y - life.gridRect.y)).toBeLessThan(F32_EPS);
  });

  it("cellIndexForDate returns -1 off-grid and never clamps to an edge", () => {
    const life = build(VIEW_LIFE);
    const dob = parseDob(PROFILE.dob, NOW);
    const expectancy = getExpectancyDate(PROFILE, NOW);
    expect(dob).not.toBeNull();
    if (!dob) return;
    const idx = life.cellIndexForDate!.bind(life);
    // Birth week is the first instanced cell; expectancy week is the last.
    expect(idx(dob)).toBe(0);
    expect(idx(expectancy)).toBe(life.cellCount - 1);
    // A week before birth and a week after expectancy are both off-grid — and
    // must NOT clamp the way liveState does.
    const beforeBirth = new Date(dob.getTime() - 8 * MS_PER_WEEK);
    const afterExpectancy = new Date(expectancy.getTime() + 8 * MS_PER_WEEK);
    expect(idx(beforeBirth)).toBe(-1);
    expect(idx(afterExpectancy)).toBe(-1);
    expect(life.liveState(afterExpectancy).index).toBe(life.cellCount - 1);
  });

  it("landscape: second block starts 57 col-units in, at the top row", () => {
    const life = build(VIEW_LIFE);
    const dob = parseDob(PROFILE.dob, NOW);
    const expectancy = getExpectancyDate(PROFILE, NOW);
    expect(dob).not.toBeNull();
    if (!dob) return;
    const firstYear = isoWeekYear(dob);
    const yearCount = isoWeekYear(expectancy) - firstYear + 1;
    const rowsPerBlock = Math.ceil(yearCount / 2);
    // Index of the first cell in block 2: all rows of block 1.
    let idx = weeksInIsoYear(firstYear) - (isoWeek(dob) - 1);
    for (let r = 1; r < rowsPerBlock; r++) {
      idx += weeksInIsoYear(firstYear + r);
    }
    const r = life.cellRect(idx);
    expect(
      Math.abs(r.x - (life.gridRect.x + 57 * life.cellW)),
    ).toBeLessThan(F32_EPS);
    expect(Math.abs(r.y - life.gridRect.y)).toBeLessThan(F32_EPS);
  });
});

describe("axis specs", () => {
  it("DAY: 24 hour ticks, majors 00/06/12/18, per-hour minors", () => {
    const day = build(VIEW_DAY);
    expect(day.axis.left.length).toBe(24);
    for (let h = 0; h < 24; h++) {
      const tick = day.axis.left[h];
      if (h % 6 === 0) {
        expect(tick.major).toBe(true);
        expect(tick.label).toBe(String(h).padStart(2, "0"));
      } else {
        expect(tick.major).toBe(false);
        expect(tick.label).toBe("");
      }
    }
    expect(day.axis.activeLeft).toBe(12);
    expect(day.axis.top).toEqual([]);
  });

  it("WEEK: MON..SUN on the top axis, today active", () => {
    const week = build(VIEW_WEEK);
    expect(week.axis.top.map((t) => t.label)).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
    expect(week.axis.activeTop).toBe(3);
  });

  it("YEAR: month labels on the left axis, one per row band, y ascending", () => {
    // The grid wraps 4 week-runs per row, so months label rows, not columns.
    const year = build(VIEW_YEAR);
    expect(year.axis.top).toEqual([]);
    const labels = year.axis.left.map((t) => t.label);
    expect(labels[0]).toBe("JAN");
    expect(labels.length).toBeGreaterThanOrEqual(10);
    expect(labels.length).toBeLessThanOrEqual(12);
    expect(labels).toContain("JUL");
    expect(year.axis.left[year.axis.activeLeft]?.label).toBe("JUL");
    for (let i = 1; i < year.axis.left.length; i++) {
      expect(year.axis.left[i].pos).toBeGreaterThan(year.axis.left[i - 1].pos);
    }
    for (const tick of year.axis.left) {
      expect(tick.pos).toBeGreaterThanOrEqual(year.gridRect.y);
      expect(tick.pos).toBeLessThanOrEqual(year.gridRect.y + year.gridRect.h);
    }
  });

  it("LIFE: decade majors labeled by age, per-year minors", () => {
    const life = build(VIEW_LIFE);
    expect(life.axis.left.length).toBeGreaterThan(0);
    for (let r = 0; r < life.axis.left.length; r++) {
      const tick = life.axis.left[r];
      if (r % 10 === 0) {
        expect(tick.major).toBe(true);
        expect(tick.label).toBe(String(r));
      } else {
        expect(tick.major).toBe(false);
        expect(tick.label).toBe("");
      }
    }
  });
});

describe("morph opacity envelopes (§4.2)", () => {
  it("child fades out over p 0.6→0.85", () => {
    expect(childOpacity(0)).toBe(1);
    expect(childOpacity(0.6)).toBe(1);
    expect(childOpacity(0.725)).toBeCloseTo(0.5, 9);
    expect(childOpacity(0.85)).toBe(0);
    expect(childOpacity(1)).toBe(0);
  });

  it("sibling reveal over p 0.15→0.5", () => {
    expect(parentOpacity(0)).toBe(0);
    expect(parentOpacity(0.15)).toBe(0);
    expect(parentOpacity(0.325)).toBeCloseTo(0.5, 9);
    expect(parentOpacity(0.5)).toBe(1);
    expect(parentOpacity(1)).toBe(1);
  });

  it("slot interior crossfades in over p 0.6→0.85", () => {
    expect(slotInteriorOpacity(0.6)).toBe(0);
    expect(slotInteriorOpacity(0.85)).toBe(1);
  });

  it("slot outline fades in 0.05→0.25 and out 0.85→1", () => {
    expect(slotOutlineOpacity(0)).toBe(0);
    expect(slotOutlineOpacity(0.05)).toBe(0);
    expect(slotOutlineOpacity(0.25)).toBe(1);
    expect(slotOutlineOpacity(0.5)).toBe(1);
    expect(slotOutlineOpacity(0.85)).toBe(1);
    expect(slotOutlineOpacity(1)).toBe(0);
  });

  it("computeMorphEnvelope composes the four envelopes", () => {
    const env = computeMorphEnvelope(0.7);
    expect(env.childOpacity).toBeCloseTo(childOpacity(0.7), 12);
    expect(env.parentOpacity).toBeCloseTo(parentOpacity(0.7), 12);
    expect(env.slotInteriorOpacity).toBeCloseTo(slotInteriorOpacity(0.7), 12);
    expect(env.slotOutlineOpacity).toBeCloseTo(slotOutlineOpacity(0.7), 12);
  });
});
