import { describe, expect, it } from "vitest";
import {
  formatPeriodKey,
  parsePeriodKey,
  periodLabel,
  periodRange,
  periodFromDate,
  nextPeriod,
  comparePeriodsDesc,
  weekOfMonth,
} from "@/domain/finance/period";

describe("period keys", () => {
  it("round-trips", () => {
    for (const p of [{ year: 2026, month: 1 }, { year: 2026, month: 8 }, { year: 2026, month: 12 }]) {
      expect(parsePeriodKey(formatPeriodKey(p))).toEqual(p);
    }
  });

  it("zero-pads single-digit months so keys sort as strings", () => {
    expect(formatPeriodKey({ year: 2026, month: 8 })).toBe("2026-08");
    const keys = [{ year: 2026, month: 10 }, { year: 2026, month: 2 }].map(formatPeriodKey).sort();
    expect(keys).toEqual(["2026-02", "2026-10"]);
  });

  it("rejects malformed or impossible keys", () => {
    for (const bad of ["", "2026", "2026-", "2026-13", "2026-00", "26-08", "2026-8", "abcd-ef", "1999-08", "2101-01"]) {
      expect(parsePeriodKey(bad)).toBeNull();
    }
    expect(parsePeriodKey(undefined)).toBeNull();
    expect(parsePeriodKey(null)).toBeNull();
  });
});

describe("periodRange", () => {
  // The bug this guards against: a range built in local time putting the 1st
  // of the month into the previous month for anyone east of UTC — which is
  // everyone using this app.
  it("covers exactly the month, in UTC", () => {
    const { from, to } = periodRange({ year: 2026, month: 8 });
    expect(from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("handles February in a leap year and a common year", () => {
    expect(periodRange({ year: 2024, month: 2 }).to.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    expect(periodRange({ year: 2026, month: 2 }).to.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("handles December without spilling into the next year", () => {
    const { from, to } = periodRange({ year: 2026, month: 12 });
    expect(from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("round-trips a date through periodFromDate back into its own range", () => {
    const d = new Date("2026-08-31T23:00:00.000Z");
    const { from, to } = periodRange(periodFromDate(d));
    expect(d >= from && d <= to).toBe(true);
  });
});

describe("periodLabel", () => {
  it("names months from 1, not 0", () => {
    expect(periodLabel({ year: 2026, month: 1 })).toBe("January 2026");
    expect(periodLabel({ year: 2026, month: 8 })).toBe("August 2026");
    expect(periodLabel({ year: 2026, month: 12 })).toBe("December 2026");
  });
});

describe("nextPeriod", () => {
  it("rolls the year at December", () => {
    expect(nextPeriod({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
    expect(nextPeriod({ year: 2026, month: 8 })).toEqual({ year: 2026, month: 9 });
  });
});

describe("comparePeriodsDesc", () => {
  it("sorts newest first across a year boundary", () => {
    const sorted = [
      { year: 2025, month: 12 },
      { year: 2026, month: 3 },
      { year: 2026, month: 1 },
    ].sort(comparePeriodsDesc);
    expect(sorted).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });
});

describe("weekOfMonth", () => {
  it("buckets by day-of-month the way the Payment Tracker does", () => {
    expect(weekOfMonth(new Date("2026-08-01T00:00:00Z"))).toBe(1);
    expect(weekOfMonth(new Date("2026-08-07T00:00:00Z"))).toBe(1);
    expect(weekOfMonth(new Date("2026-08-08T00:00:00Z"))).toBe(2);
    expect(weekOfMonth(new Date("2026-08-28T00:00:00Z"))).toBe(4);
  });

  // The workbook has four buckets, not five: days 29-31 fold into Week 4.
  // The import round-trip depends on this, so a fifth bucket would silently
  // break re-importing an exported Payment Tracker.
  it("folds the month's tail into Week 4 rather than opening a fifth", () => {
    expect(weekOfMonth(new Date("2026-08-29T00:00:00Z"))).toBe(4);
    expect(weekOfMonth(new Date("2026-08-31T00:00:00Z"))).toBe(4);
  });
});
