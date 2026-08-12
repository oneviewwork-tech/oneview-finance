import { describe, expect, it } from "vitest";
import { previousPeriod, resolvePresetRange } from "@/domain/finance/date-range";

// Wednesday 2026-08-12, per the workbook's "August 2026" context.
const NOW = new Date(Date.UTC(2026, 7, 12, 10, 30));

describe("resolvePresetRange", () => {
  it("TODAY spans just the current UTC day", () => {
    const { from, to } = resolvePresetRange("TODAY", NOW);
    expect(from.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-12T23:59:59.999Z");
  });

  it("THIS_WEEK starts Monday", () => {
    const { from } = resolvePresetRange("THIS_WEEK", NOW);
    // 2026-08-12 is a Wednesday -> Monday is 2026-08-10.
    expect(from.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("THIS_MONTH starts on the 1st", () => {
    const { from } = resolvePresetRange("THIS_MONTH", NOW);
    expect(from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("LAST_MONTH spans the full previous calendar month", () => {
    const { from, to } = resolvePresetRange("LAST_MONTH", NOW);
    expect(from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });

  it("LAST_MONTH rolls back across a year boundary", () => {
    const jan = new Date(Date.UTC(2026, 0, 15));
    const { from, to } = resolvePresetRange("LAST_MONTH", jan);
    expect(from.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2025-12-31T23:59:59.999Z");
  });

  it("THIS_QUARTER starts at the quarter's first month", () => {
    const { from } = resolvePresetRange("THIS_QUARTER", NOW);
    expect(from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("THIS_YEAR starts January 1st", () => {
    const { from } = resolvePresetRange("THIS_YEAR", NOW);
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("previousPeriod", () => {
  it("returns an equal-length window immediately before the given range", () => {
    const range = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };
    const prev = previousPeriod(range);
    expect(prev.to.getTime()).toBe(range.from.getTime() - 1);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(range.to.getTime() - range.from.getTime());
  });
});

// ── Range selection: month + custom span ──────────────────────────────

import { describeSelection, monthRange, parseRangeSelection, recentMonths, resolveSelection } from "@/domain/finance/date-range";

describe("monthRange", () => {
  it("covers the whole calendar month inclusive of the last day", () => {
    const { from, to } = monthRange(2026, 7);
    expect(from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });

  it("handles February in a leap year", () => {
    expect(monthRange(2028, 2).to.toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });
});

describe("parseRangeSelection", () => {
  it("reads a preset", () => {
    expect(parseRangeSelection({ range: "LAST_MONTH" })).toEqual({ kind: "preset", preset: "LAST_MONTH" });
  });

  it("reads a specific month", () => {
    expect(parseRangeSelection({ range: "MONTH", month: "2026-07" })).toEqual({ kind: "month", year: 2026, month: 7 });
  });

  it("reads a custom span", () => {
    const sel = parseRangeSelection({ range: "CUSTOM", from: "2026-07-01", to: "2026-07-15" });
    expect(sel.kind).toBe("custom");
    if (sel.kind === "custom") {
      expect(sel.from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(sel.to.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    }
  });

  it("swaps a reversed custom span instead of returning an empty range", () => {
    const sel = parseRangeSelection({ range: "CUSTOM", from: "2026-07-15", to: "2026-07-01" });
    if (sel.kind === "custom") {
      expect(sel.from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(sel.to.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    }
  });

  it("falls back to THIS_MONTH on malformed input", () => {
    expect(parseRangeSelection({ range: "MONTH", month: "nope" })).toEqual({ kind: "preset", preset: "THIS_MONTH" });
    expect(parseRangeSelection({ range: "CUSTOM", from: "2026-07-01" })).toEqual({ kind: "preset", preset: "THIS_MONTH" });
    expect(parseRangeSelection({ range: "MONTH", month: "2026-13" })).toEqual({ kind: "preset", preset: "THIS_MONTH" });
    expect(parseRangeSelection({})).toEqual({ kind: "preset", preset: "THIS_MONTH" });
  });
});

describe("resolveSelection", () => {
  it("resolves a custom span to full inclusive days", () => {
    const range = resolveSelection({
      kind: "custom",
      from: new Date(Date.UTC(2026, 6, 1)),
      to: new Date(Date.UTC(2026, 6, 15)),
    });
    expect(range.from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-07-15T23:59:59.999Z");
  });

  it("resolves a month selection to that whole month", () => {
    const range = resolveSelection({ kind: "month", year: 2026, month: 2 });
    expect(range.to.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });
});

describe("describeSelection", () => {
  it("labels each kind readably", () => {
    expect(describeSelection({ kind: "preset", preset: "THIS_MONTH" })).toBe("This Month");
    expect(describeSelection({ kind: "month", year: 2026, month: 7 })).toBe("July 2026");
    expect(
      describeSelection({ kind: "custom", from: new Date(Date.UTC(2026, 6, 1)), to: new Date(Date.UTC(2026, 6, 15)) })
    ).toBe("01 Jul 2026 to 15 Jul 2026");
  });
});

describe("recentMonths", () => {
  it("lists months newest first ending at the anchor month", () => {
    const months = recentMonths(3, new Date(Date.UTC(2026, 7, 11)));
    expect(months.map((m) => m.label)).toEqual(["August 2026", "July 2026", "June 2026"]);
  });

  it("rolls back across a year boundary", () => {
    const months = recentMonths(2, new Date(Date.UTC(2026, 0, 15)));
    expect(months.map((m) => m.label)).toEqual(["January 2026", "December 2025"]);
  });
});
