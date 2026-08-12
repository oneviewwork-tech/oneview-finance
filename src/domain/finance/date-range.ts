export interface DateRange {
  from: Date;
  to: Date;
}

export type DateRangePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Resolves the spec's Financial Intelligence date filter presets to a
 * concrete [from, to] range, anchored to `now` (defaults to the real
 * current time — pass an explicit `now` in tests for determinism).
 */
export function resolvePresetRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const today = startOfUtcDay(now);

  switch (preset) {
    case "TODAY":
      return { from: today, to: endOfUtcDay(now) };

    case "THIS_WEEK": {
      // Monday-start week, matching the business's Mon-Sat work week convention.
      const dow = today.getUTCDay(); // 0=Sun..6=Sat
      const diffToMonday = dow === 0 ? 6 : dow - 1;
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - diffToMonday);
      return { from, to: endOfUtcDay(now) };
    }

    case "THIS_MONTH": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { from, to: endOfUtcDay(now) };
    }

    case "LAST_MONTH": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
      return { from, to };
    }

    case "THIS_QUARTER": {
      const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
      const from = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));
      return { from, to: endOfUtcDay(now) };
    }

    case "THIS_YEAR": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      return { from, to: endOfUtcDay(now) };
    }
  }
}

/** The immediately preceding period of equal length — used for period-over-period comparison. */
export function previousPeriod(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs - 1),
    to: new Date(range.from.getTime() - 1),
  };
}

// ── Range selection: presets, a specific month, or a custom span ──────

export type RangeSelection =
  | { kind: "preset"; preset: DateRangePreset }
  | { kind: "month"; year: number; month: number } // month is 1-12
  | { kind: "custom"; from: Date; to: Date };

const PRESETS: DateRangePreset[] = ["TODAY", "THIS_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR"];

/** Whole calendar month, inclusive of its last day. */
export function monthRange(year: number, month: number): DateRange {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export function resolveSelection(selection: RangeSelection, now: Date = new Date()): DateRange {
  switch (selection.kind) {
    case "preset":
      return resolvePresetRange(selection.preset, now);
    case "month":
      return monthRange(selection.year, selection.month);
    case "custom":
      return {
        from: startOfUtcDay(selection.from),
        to: endOfUtcDay(selection.to),
      };
  }
}

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses the URL's range params into a selection, falling back to
 * THIS_MONTH for anything malformed. Accepts:
 *   range=THIS_MONTH            (preset)
 *   range=MONTH&month=2026-07   (specific calendar month)
 *   range=CUSTOM&from=..&to=..  (explicit span)
 */
export function parseRangeSelection(params: {
  range?: string;
  month?: string;
  from?: string;
  to?: string;
}): RangeSelection {
  const fallback: RangeSelection = { kind: "preset", preset: "THIS_MONTH" };

  if (params.range === "MONTH") {
    if (!params.month || !/^\d{4}-\d{2}$/.test(params.month)) return fallback;
    const [year, month] = params.month.split("-").map(Number);
    if (month < 1 || month > 12) return fallback;
    return { kind: "month", year, month };
  }

  if (params.range === "CUSTOM") {
    const from = parseDateParam(params.from);
    const to = parseDateParam(params.to);
    if (!from || !to) return fallback;
    // Tolerate a reversed span rather than showing an empty dashboard.
    return from <= to ? { kind: "custom", from, to } : { kind: "custom", from: to, to: from };
  }

  if (params.range && PRESETS.includes(params.range as DateRangePreset)) {
    return { kind: "preset", preset: params.range as DateRangePreset };
  }
  return fallback;
}

const PRESET_LABEL: Record<DateRangePreset, string> = {
  TODAY: "Today",
  THIS_WEEK: "This Week",
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_QUARTER: "This Quarter",
  THIS_YEAR: "This Year",
};

function fmtDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function fmtMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** Short label for the filter control, e.g. "This Month", "July 2026", "01 Jul 2026 to 15 Jul 2026". */
export function describeSelection(selection: RangeSelection): string {
  switch (selection.kind) {
    case "preset":
      return PRESET_LABEL[selection.preset];
    case "month":
      return fmtMonth(selection.year, selection.month);
    case "custom":
      return `${fmtDay(selection.from)} to ${fmtDay(selection.to)}`;
  }
}

/** Sentence fragment used in page subtitles and empty states. */
export function describeSelectionLong(selection: RangeSelection): string {
  switch (selection.kind) {
    case "preset":
      return PRESET_LABEL[selection.preset].toLowerCase();
    case "month":
      return `in ${fmtMonth(selection.year, selection.month)}`;
    case "custom":
      return `from ${fmtDay(selection.from)} to ${fmtDay(selection.to)}`;
  }
}

/** The last `count` calendar months, newest first, for the month picker. */
export function recentMonths(count: number, now: Date = new Date()): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    out.push({ year, month, label: fmtMonth(year, month) });
  }
  return out;
}
