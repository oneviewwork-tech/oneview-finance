import { describe, expect, it } from "vitest";
import { monthKey, monthLabel, quarterOfYear, weekLabel, weekOfMonth } from "@/domain/finance/period";

describe("weekOfMonth", () => {
  it("buckets day 1-7 as Week 1", () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 7, 5)))).toBe(1);
  });

  it("buckets day 8-14 as Week 2", () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 7, 10)))).toBe(2);
  });

  it("buckets day 15-21 as Week 3", () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 7, 18)))).toBe(3);
  });

  it("buckets day 22-28 as Week 4", () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 7, 25)))).toBe(4);
  });

  it("folds day 29-31 into Week 4 rather than a 5th bucket", () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 7, 31)))).toBe(4);
  });
});

describe("weekLabel", () => {
  it("matches the workbook's 'WEEK N' text label", () => {
    expect(weekLabel(new Date(Date.UTC(2026, 7, 3)))).toBe("WEEK 1");
  });
});

describe("monthLabel", () => {
  it("matches the workbook's TEXT(date,\"MMM-YY\") format", () => {
    expect(monthLabel(new Date(Date.UTC(2026, 7, 5)))).toBe("Aug-26");
  });
});

describe("monthKey", () => {
  it("produces a sortable YYYY-MM key", () => {
    expect(monthKey(new Date(Date.UTC(2026, 7, 5)))).toBe("2026-08");
  });
});

describe("quarterOfYear", () => {
  it("computes calendar quarter", () => {
    expect(quarterOfYear(new Date(Date.UTC(2026, 7, 5)))).toBe(3);
  });
});
