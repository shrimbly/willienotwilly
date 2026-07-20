import { describe, expect, it } from "vitest";

import { PLACE_PALETTE, buildPlaceBands, placeYears } from "@/lib/life-places";
import type { LifeProfile } from "@/lib/life-clock";
import { DEFAULT_PROFILE } from "@/lib/life-clock-storage";

const NOW = new Date(2026, 6, 20, 12, 0, 0);

function profile(places: LifeProfile["places"]): LifeProfile {
  return {
    v: 2,
    dob: "1991-02-17",
    sex: "male",
    smoking: "never",
    exercise: "weekly",
    region: "western-europe-oceania",
    places,
    demo: false,
    savedAt: "2026-07-20T00:00:00.000Z",
  };
}

describe("buildPlaceBands — author's places", () => {
  const bands = buildPlaceBands(DEFAULT_PROFILE, NOW);

  it("resolves every place, in order", () => {
    expect(bands.map((b) => b.label)).toEqual([
      "Wairarapa",
      "Wellington",
      "Travelling",
      "London",
      "Auckland",
    ]);
  });

  it("assigns palette colours in order", () => {
    for (let i = 0; i < bands.length; i += 1) {
      expect(bands[i].hex).toBe(PLACE_PALETTE[i]);
    }
  });

  it("leaves no gaps between consecutive stays", () => {
    for (let i = 1; i < bands.length; i += 1) {
      // The next stay begins no later than the previous one ends.
      expect(bands[i].start.getTime()).toBeLessThanOrEqual(
        bands[i - 1].end.getTime(),
      );
    }
  });

  it("clamps the open-ended final stay to now and flags it ongoing", () => {
    const auckland = bands[bands.length - 1];
    expect(auckland.label).toBe("Auckland");
    expect(auckland.ongoing).toBe(true);
    expect(auckland.end.getTime()).toBe(NOW.getTime());
    // Closed stays are not ongoing.
    expect(bands[0].ongoing).toBe(false);
  });

  it("exposes raw sRGB components in 0..1", () => {
    for (const b of bands) {
      for (const c of b.rgb) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("buildPlaceBands — omission and fallback", () => {
  it("is empty for a profile with no places", () => {
    expect(buildPlaceBands(profile(undefined), NOW)).toEqual([]);
  });

  it("drops a place with an unparseable start", () => {
    const bands = buildPlaceBands(
      profile([
        { label: "Nowhere", start: "not-a-date" },
        { label: "Somewhere", start: "2010-01-01", end: "2011-01-01" },
      ]),
      NOW,
    );
    expect(bands.map((b) => b.label)).toEqual(["Somewhere"]);
  });

  it("falls back to now when the end is missing or before the start", () => {
    const bands = buildPlaceBands(
      profile([{ label: "Backwards", start: "2015-01-01", end: "2014-01-01" }]),
      NOW,
    );
    expect(bands[0].end.getTime()).toBe(NOW.getTime());
    expect(bands[0].ongoing).toBe(true);
  });

  it("cycles the palette when there are more places than colours", () => {
    const many = Array.from({ length: PLACE_PALETTE.length + 1 }, (_, i) => ({
      label: `P${i}`,
      start: `20${String(10 + i).padStart(2, "0")}-01-01`,
    }));
    const bands = buildPlaceBands(profile(many), NOW);
    expect(bands[PLACE_PALETTE.length].hex).toBe(PLACE_PALETTE[0]);
  });
});

describe("placeYears", () => {
  const [wairarapa, , travelling, , auckland] = buildPlaceBands(
    DEFAULT_PROFILE,
    NOW,
  );

  it("shows a span across years", () => {
    expect(placeYears(wairarapa)).toBe("1991–2009");
  });

  it("collapses a within-one-year stay to that year", () => {
    expect(placeYears(travelling)).toBe("2019");
  });

  it("marks an ongoing stay with now", () => {
    expect(placeYears(auckland)).toBe("2021–now");
  });
});
