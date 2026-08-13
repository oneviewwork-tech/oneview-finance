import { describe, expect, it } from "vitest";
import { COMBINED_METRICS, parseCombinedMetric, type CombinedMetricKey } from "@/domain/finance/combined-metrics";

describe("parseCombinedMetric", () => {
  it("resolves every registered key", () => {
    for (const key of Object.keys(COMBINED_METRICS) as CombinedMetricKey[]) {
      expect(parseCombinedMetric(key)?.key).toBe(key);
    }
  });

  it("rejects anything unknown rather than guessing", () => {
    expect(parseCombinedMetric("profit")).toBeNull();
    expect(parseCombinedMetric("")).toBeNull();
    expect(parseCombinedMetric(undefined)).toBeNull();
    // Keys are exact — no case-coercion, so a typo fails loudly.
    expect(parseCombinedMetric("TOTALINFLOW")).toBeNull();
  });

  it("does not resolve inherited Object properties", () => {
    expect(parseCombinedMetric("toString")).toBeNull();
    expect(parseCombinedMetric("constructor")).toBeNull();
  });
});

describe("COMBINED_METRICS", () => {
  it("keys itself consistently, so a lookup can't return a mismatched spec", () => {
    for (const [key, spec] of Object.entries(COMBINED_METRICS)) {
      expect(spec.key).toBe(key);
    }
  });

  // A count is not money: FX-converting it, or showing it under a currency
  // column, would be meaningless.
  it("marks clientsClosed as the only non-money metric", () => {
    const nonMoney = Object.values(COMBINED_METRICS).filter((m) => !m.isMoney).map((m) => m.key);
    expect(nonMoney).toEqual(["clientsClosed"]);
  });

  // Scoped to the payroll category, not just PAID: without it this opened
  // every paid expense, so the list bore no relation to the salary figure
  // that was clicked.
  it("drills salary into payroll rows, not every paid expense", () => {
    expect(COMBINED_METRICS.salaryPaid.isMoney).toBe(true);
    const path = COMBINED_METRICS.salaryPaid.recordsPath!("uae");
    expect(path).toContain("/operations/uae/outflow/all");
    expect(path).toContain("status=PAID");
    expect(decodeURIComponent(path)).toContain("category=Salaries & Allowances");
  });

  it("points money metrics at the records that make them up", () => {
    expect(COMBINED_METRICS.outflowPending.recordsPath!("uae")).toBe("/operations/uae/outflow/all?status=unpaid");
    expect(COMBINED_METRICS.receivables.recordsPath!("india")).toBe("/operations/india/inflow/all?status=unpaid");
    expect(COMBINED_METRICS.outflowPaid.recordsPath!("uae")).toBe("/operations/uae/outflow/all?status=PAID");
  });

  // Net position is derived from two other figures; there is no single list
  // of "net position rows" to link to, and inventing one would mislead.
  it("gives netPosition no records link", () => {
    expect(COMBINED_METRICS.netPosition.recordsPath).toBeUndefined();
  });

  it("labels and describes every metric", () => {
    for (const spec of Object.values(COMBINED_METRICS)) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });
});
