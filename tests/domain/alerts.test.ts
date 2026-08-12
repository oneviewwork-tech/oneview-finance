import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  ageingBucket,
  alertSeverity,
  daysBetween,
  summariseAgeing,
  totalOverdue,
  type AgeableItem,
} from "@/domain/finance/alerts";

const D = (v: string | number) => new Prisma.Decimal(v);
const TODAY = new Date(Date.UTC(2026, 7, 13)); // 13 Aug 2026
const daysAgo = (n: number) => new Date(Date.UTC(2026, 7, 13 - n));

describe("daysBetween", () => {
  it("counts whole UTC days", () => {
    expect(daysBetween(daysAgo(10), TODAY)).toBe(10);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });

  it("ignores time-of-day so a same-day transaction is never 1 day old", () => {
    const morning = new Date(Date.UTC(2026, 7, 13, 1));
    const evening = new Date(Date.UTC(2026, 7, 13, 23));
    expect(daysBetween(morning, evening)).toBe(0);
  });

  it("returns negative for a future date", () => {
    expect(daysBetween(new Date(Date.UTC(2026, 7, 20)), TODAY)).toBe(-7);
  });
});

describe("ageingBucket", () => {
  it("treats today and future dates as not yet due", () => {
    expect(ageingBucket(TODAY, TODAY)).toBe("CURRENT");
    expect(ageingBucket(new Date(Date.UTC(2026, 8, 1)), TODAY)).toBe("CURRENT");
  });

  it("places items in the right bucket at each boundary", () => {
    expect(ageingBucket(daysAgo(1), TODAY)).toBe("DUE_0_30");
    expect(ageingBucket(daysAgo(30), TODAY)).toBe("DUE_0_30");
    expect(ageingBucket(daysAgo(31), TODAY)).toBe("DUE_31_60");
    expect(ageingBucket(daysAgo(60), TODAY)).toBe("DUE_31_60");
    expect(ageingBucket(daysAgo(61), TODAY)).toBe("DUE_61_90");
    expect(ageingBucket(daysAgo(90), TODAY)).toBe("DUE_61_90");
    expect(ageingBucket(daysAgo(91), TODAY)).toBe("DUE_90_PLUS");
  });
});

describe("alertSeverity", () => {
  // The rule that matters most: settled money is never a problem.
  it("never alerts on a PAID item, however old", () => {
    expect(alertSeverity("PAID", daysAgo(365), TODAY)).toBeNull();
  });

  it("does not alert on unsettled items that aren't late yet", () => {
    expect(alertSeverity("PENDING", TODAY, TODAY)).toBeNull();
    expect(alertSeverity("PARTIAL", TODAY, TODAY)).toBeNull();
  });

  it("escalates with age", () => {
    expect(alertSeverity("PENDING", daysAgo(10), TODAY)).toBe("info");
    expect(alertSeverity("PENDING", daysAgo(45), TODAY)).toBe("warning");
    expect(alertSeverity("PENDING", daysAgo(75), TODAY)).toBe("critical");
    expect(alertSeverity("PARTIAL", daysAgo(120), TODAY)).toBe("critical");
  });
});

describe("summariseAgeing", () => {
  const items: AgeableItem[] = [
    { transactionDate: daysAgo(0), status: "PENDING", outstanding: D(100) }, // CURRENT
    { transactionDate: daysAgo(5), status: "PENDING", outstanding: D(200) }, // 0-30
    { transactionDate: daysAgo(20), status: "PARTIAL", outstanding: D(50) }, // 0-30
    { transactionDate: daysAgo(40), status: "PENDING", outstanding: D(300) }, // 31-60
    { transactionDate: daysAgo(200), status: "PENDING", outstanding: D(400) }, // 90+
    { transactionDate: daysAgo(300), status: "PAID", outstanding: D(0) }, // excluded
    { transactionDate: daysAgo(50), status: "PARTIAL", outstanding: D(0) }, // excluded: nothing left
  ];

  it("always returns all five buckets, even the empty ones", () => {
    const rows = summariseAgeing([], TODAY);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.count === 0 && r.total.eq(0))).toBe(true);
  });

  it("groups and sums only genuinely outstanding money", () => {
    const rows = summariseAgeing(items, TODAY);
    const by = Object.fromEntries(rows.map((r) => [r.bucket, r]));

    expect(by.CURRENT.count).toBe(1);
    expect(by.CURRENT.total.toString()).toBe("100");

    expect(by.DUE_0_30.count).toBe(2);
    expect(by.DUE_0_30.total.toString()).toBe("250");

    expect(by.DUE_31_60.count).toBe(1);
    expect(by.DUE_31_60.total.toString()).toBe("300");

    expect(by.DUE_61_90.count).toBe(0);
    expect(by.DUE_90_PLUS.total.toString()).toBe("400");
  });

  it("excludes PAID rows and zero-balance rows entirely", () => {
    const rows = summariseAgeing(items, TODAY);
    const counted = rows.reduce((n, r) => n + r.count, 0);
    expect(counted).toBe(5); // 7 items, 2 excluded
  });
});

describe("totalOverdue", () => {
  it("sums every bucket except CURRENT", () => {
    const rows = summariseAgeing(
      [
        { transactionDate: daysAgo(0), status: "PENDING", outstanding: D(100) },
        { transactionDate: daysAgo(10), status: "PENDING", outstanding: D(200) },
        { transactionDate: daysAgo(100), status: "PENDING", outstanding: D(400) },
      ],
      TODAY
    );
    // 600, not 700 — the not-yet-due 100 is excluded.
    expect(totalOverdue(rows).toString()).toBe("600");
  });
});
