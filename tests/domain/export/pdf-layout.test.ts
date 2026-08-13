import { describe, expect, it } from "vitest";
import { columnWidths, columnOffsets, fitText, paginate } from "@/domain/export/pdf-layout";

// Stand-in for a proportional font: 'i' is narrow, 'M' is wide.
const measure = (s: string) =>
  [...s].reduce((w, ch) => w + (ch === "i" || ch === "l" ? 2 : ch === "M" || ch === "W" ? 10 : 6), 0);

describe("columnWidths", () => {
  it("splits by weight, accounting for gaps", () => {
    const w = columnWidths([{ weight: 1 }, { weight: 1 }], 100, 10);
    expect(w).toEqual([45, 45]); // (100 - 10) / 2
  });

  it("honours uneven weights", () => {
    const w = columnWidths([{ weight: 3 }, { weight: 1 }], 90, 10);
    expect(w).toEqual([60, 20]);
  });
});

describe("columnOffsets", () => {
  it("advances by width plus gap", () => {
    expect(columnOffsets([50, 30, 20], 10, 40)).toEqual([40, 100, 140]);
  });
});

describe("fitText", () => {
  it("leaves text that already fits alone", () => {
    expect(fitText("abc", 100, measure)).toBe("abc");
  });

  it("truncates with an ellipsis rather than overflowing", () => {
    const out = fitText("abcdefghijklmnop", 40, measure);
    expect(out.endsWith("…")).toBe(true);
    expect(measure(out)).toBeLessThanOrEqual(40);
  });

  it("measures per character, so narrow text keeps more of itself", () => {
    const narrow = fitText("iiiiiiiiiiiiiiii", 40, measure);
    const wide = fitText("MMMMMMMMMMMMMMMM", 40, measure);
    expect(narrow.length).toBeGreaterThan(wide.length);
  });

  it("returns empty when even the ellipsis cannot fit", () => {
    expect(fitText("abc", 1, measure)).toBe("");
  });
});

describe("paginate", () => {
  it("fills the first page then continues", () => {
    const pages = paginate(10, { firstPageHeight: 100, laterPageHeight: 100, rowHeight: 20, headerHeight: 20 });
    // (100-20)/20 = 4 rows per page
    expect(pages).toHaveLength(3);
    expect(pages[0].rows).toEqual([0, 1, 2, 3]);
    expect(pages[2].rows).toEqual([8, 9]);
  });

  // The header is redrawn per page; forgetting that overfills later pages.
  it("subtracts the repeated header from every page, not just the first", () => {
    const pages = paginate(8, { firstPageHeight: 60, laterPageHeight: 100, rowHeight: 20, headerHeight: 20 });
    expect(pages[0].rows).toHaveLength(2); // (60-20)/20
    expect(pages[1].rows).toHaveLength(4); // (100-20)/20
  });

  it("never emits a zero-capacity page, even when space is tight", () => {
    const pages = paginate(3, { firstPageHeight: 10, laterPageHeight: 10, rowHeight: 20, headerHeight: 20 });
    expect(pages.every((p) => p.rows.length >= 1)).toBe(true);
  });

  it("returns one empty page for zero rows so the header still renders", () => {
    expect(paginate(0, { firstPageHeight: 100, laterPageHeight: 100, rowHeight: 20, headerHeight: 20 })).toEqual([
      { rows: [] },
    ]);
  });
});
