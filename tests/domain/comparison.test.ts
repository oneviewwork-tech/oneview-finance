import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculatePeriodChange } from "@/domain/finance/comparison";

const D = (v: number | string) => new Prisma.Decimal(v);

describe("calculatePeriodChange", () => {
  it("computes growth as a positive fraction", () => {
    const result = calculatePeriodChange(D(1142000), D(1000000));
    expect(result.absoluteChange.toString()).toBe("142000");
    expect(result.percentChange?.toString()).toBe("0.142");
  });

  it("computes decline as a negative fraction", () => {
    const result = calculatePeriodChange(D(800000), D(1000000));
    expect(result.percentChange?.toString()).toBe("-0.2");
  });

  it("returns null percentChange when previous was zero — never a misleading %", () => {
    const result = calculatePeriodChange(D(50000), D(0));
    expect(result.absoluteChange.toString()).toBe("50000");
    expect(result.percentChange).toBeNull();
  });

  it("handles zero-to-zero with no change", () => {
    const result = calculatePeriodChange(D(0), D(0));
    expect(result.absoluteChange.toString()).toBe("0");
    expect(result.percentChange).toBeNull();
  });
});
