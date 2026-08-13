/**
 * Pure layout maths for PDF tables — no pdf-lib import, so it unit-tests
 * directly. Pagination and text fitting are where PDF table code usually
 * goes wrong (rows sliced across a page break, labels overrunning their
 * column), so that arithmetic lives here rather than tangled into drawing.
 */

export interface ColumnSpec {
  /** Relative weight; widths are distributed proportionally. */
  weight: number;
  align?: "left" | "right";
}

/** Distributes available width across columns by weight. */
export function columnWidths(specs: readonly ColumnSpec[], available: number, gap: number): number[] {
  const totalWeight = specs.reduce((s, c) => s + c.weight, 0);
  const usable = available - gap * (specs.length - 1);
  return specs.map((c) => (usable * c.weight) / totalWeight);
}

/** X offset of each column's left edge. */
export function columnOffsets(widths: readonly number[], gap: number, startX: number): number[] {
  const out: number[] = [];
  let x = startX;
  for (const w of widths) {
    out.push(x);
    x += w + gap;
  }
  return out;
}

/**
 * Truncates to fit a width, appending an ellipsis.
 *
 * Takes a measuring function rather than assuming a fixed character width,
 * because proportional fonts vary enormously (an "i" is not an "M") and
 * guessing produces either clipped text or wasted space.
 */
export function fitText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  ellipsis = "…"
): string {
  if (measure(text) <= maxWidth) return text;
  if (measure(ellipsis) > maxWidth) return "";

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + ellipsis) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

export interface PagePlan {
  /** Row indices on this page. */
  rows: number[];
}

/**
 * Splits rows into pages.
 *
 * The header is redrawn on every page, so its height is subtracted from each
 * page's budget rather than only the first — getting that wrong overfills
 * every page after the first, which is the classic version of this bug.
 */
export function paginate(
  rowCount: number,
  opts: {
    firstPageHeight: number;
    laterPageHeight: number;
    rowHeight: number;
    headerHeight: number;
  }
): PagePlan[] {
  const { firstPageHeight, laterPageHeight, rowHeight, headerHeight } = opts;
  const firstCapacity = Math.max(1, Math.floor((firstPageHeight - headerHeight) / rowHeight));
  const laterCapacity = Math.max(1, Math.floor((laterPageHeight - headerHeight) / rowHeight));

  const pages: PagePlan[] = [];
  let i = 0;
  while (i < rowCount) {
    const capacity = pages.length === 0 ? firstCapacity : laterCapacity;
    const rows: number[] = [];
    for (let n = 0; n < capacity && i < rowCount; n++, i++) rows.push(i);
    pages.push({ rows });
  }
  // Always return at least one page so an empty table still renders its
  // header and an explicit "no rows" line.
  return pages.length ? pages : [{ rows: [] }];
}
