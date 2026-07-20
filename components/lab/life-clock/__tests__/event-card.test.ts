import { describe, expect, it } from "vitest";

import {
  formatEventDate,
  formatRelative,
} from "@/components/lab/life-clock/event-card";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("formatEventDate", () => {
  it("formats as local ISO date", () => {
    expect(formatEventDate(at(2036, 10, 30))).toBe("2036-10-30");
  });

  it("zero-pads month and day", () => {
    expect(formatEventDate(at(2023, 1, 5))).toBe("2023-01-05");
  });

  it("uses local calendar fields, not UTC", () => {
    const late = new Date(2024, 11, 31, 23, 59, 59);
    expect(formatEventDate(late)).toBe("2024-12-31");
  });

  it("formats a leap day", () => {
    expect(formatEventDate(at(2024, 2, 29))).toBe("2024-02-29");
  });
});

describe("formatRelative", () => {
  const now = at(2026, 7, 20);

  it("returns TODAY for the same calendar day", () => {
    expect(formatRelative(new Date(2026, 6, 20, 3, 15), now)).toBe("TODAY");
    expect(formatRelative(new Date(2026, 6, 20, 23, 45), now)).toBe("TODAY");
  });

  it("uses days below one month", () => {
    expect(formatRelative(at(2026, 8, 1), now)).toBe("IN 12D");
    expect(formatRelative(at(2026, 7, 8), now)).toBe("12D AGO");
    expect(formatRelative(at(2026, 7, 21), now)).toBe("IN 1D");
  });

  it("treats one day short of a month as days", () => {
    expect(formatRelative(at(2026, 8, 19), now)).toBe("IN 30D");
  });

  it("switches to months at exactly one month", () => {
    expect(formatRelative(at(2026, 8, 20), now)).toBe("IN 1M");
    expect(formatRelative(at(2026, 6, 20), now)).toBe("1M AGO");
  });

  it("reports whole months below a year", () => {
    expect(formatRelative(at(2026, 11, 20), now)).toBe("IN 4M");
    expect(formatRelative(at(2026, 1, 20), now)).toBe("6M AGO");
    expect(formatRelative(at(2027, 7, 19), now)).toBe("IN 11M");
  });

  it("reports exactly one year as 1Y with no month part", () => {
    expect(formatRelative(at(2027, 7, 20), now)).toBe("IN 1Y");
    expect(formatRelative(at(2025, 7, 20), now)).toBe("1Y AGO");
  });

  it("combines years and months beyond a year", () => {
    expect(formatRelative(at(2036, 10, 30), now)).toBe("IN 10Y 3M");
    expect(formatRelative(at(2010, 4, 8), now)).toBe("16Y 3M AGO");
  });

  it("omits a zero month part", () => {
    expect(formatRelative(at(2046, 7, 20), now)).toBe("IN 20Y");
  });

  it("does not round a partial month up", () => {
    expect(formatRelative(at(2027, 8, 19), now)).toBe("IN 1Y");
    expect(formatRelative(at(2027, 8, 20), now)).toBe("IN 1Y 1M");
  });

  it("handles month-end clamping without overcounting", () => {
    const jan31 = at(2026, 1, 31);
    expect(formatRelative(at(2026, 2, 28), jan31)).toBe("IN 28D");
    expect(formatRelative(at(2026, 3, 31), jan31)).toBe("IN 2M");
  });

  it("is symmetric in magnitude across the direction flip", () => {
    expect(formatRelative(at(2030, 1, 20), now)).toBe("IN 3Y 6M");
    expect(formatRelative(at(2023, 1, 20), now)).toBe("3Y 6M AGO");
  });
});
