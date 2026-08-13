import { describe, expect, it } from "vitest";
import { parseStatusFilter, statusWhereClause, describeStatusFilter } from "@/domain/finance/transaction-filter";

describe("parseStatusFilter", () => {
  it("accepts the exact statuses, case-insensitively", () => {
    expect(parseStatusFilter("PAID")).toBe("PAID");
    expect(parseStatusFilter("pending")).toBe("PENDING");
    expect(parseStatusFilter("Partial")).toBe("PARTIAL");
  });

  it("accepts 'unpaid'", () => {
    expect(parseStatusFilter("unpaid")).toBe("unpaid");
    expect(parseStatusFilter("UNPAID")).toBe("unpaid");
  });

  // A bad query string must not silently filter to nothing — it shows
  // everything, same as no filter at all.
  it("returns null for anything unrecognised or absent", () => {
    expect(parseStatusFilter("nonsense")).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
    expect(parseStatusFilter(undefined)).toBeNull();
    expect(parseStatusFilter(null)).toBeNull();
  });
});

describe("statusWhereClause", () => {
  it("omits the clause entirely when there is no filter", () => {
    expect(statusWhereClause(null)).toBeUndefined();
  });

  it("matches an exact status directly", () => {
    expect(statusWhereClause("PAID")).toBe("PAID");
  });

  // The one that matters: 'unpaid' has to catch PARTIAL as well as PENDING,
  // or a "Liabilities" drill-down understates what is actually owed.
  it("treats 'unpaid' as everything except PAID", () => {
    expect(statusWhereClause("unpaid")).toEqual({ not: "PAID" });
  });
});

describe("describeStatusFilter", () => {
  it("gives each filter a human label for the active-filter chip", () => {
    expect(describeStatusFilter("unpaid")).toBe("Not fully settled");
    expect(describeStatusFilter("PAID")).toBe("Paid");
    expect(describeStatusFilter("PARTIAL")).toBe("Partially paid");
    expect(describeStatusFilter("PENDING")).toBe("Pending");
  });
});
