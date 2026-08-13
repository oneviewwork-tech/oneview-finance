/**
 * Derives the workbook's WEEK 1-4 grouping from a transaction date instead
 * of storing it as a manually-picked field. Matches the source workbook's
 * intent (4 buckets per month) with a simple calendar-day rule: days 1-7 =
 * Week 1, 8-14 = Week 2, 15-21 = Week 3, 22-end = Week 4 (folds the 29th-31st
 * into Week 4 rather than creating a 5th bucket).
 */
export function weekOfMonth(date: Date): 1 | 2 | 3 | 4 {
  const day = date.getUTCDate();
  const week = Math.min(4, Math.ceil(day / 7));
  return week as 1 | 2 | 3 | 4;
}

export function weekLabel(date: Date): string {
  return `WEEK ${weekOfMonth(date)}`;
}

/** "MMM-YY" — same derivation the Inflow Tracker's Month column used (TEXT(date,"MMM-YY")). */
export function monthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    date
  );
  return formatted.replace(" ", "-");
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quarterOfYear(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

/**
 * The inverse of weekOfMonth — used by the Zoho import, whose Payment
 * Tracker rows carry only a "WEEK 1".."WEEK 4" label with no standalone
 * expense date. Maps a week bucket back to its first calendar day within
 * the given month (day 1/8/15/22), which round-trips correctly through
 * weekOfMonth() for every day in that bucket.
 */
export function dateForWeekOfMonth(year: number, month: number, week: 1 | 2 | 3 | 4): Date {
  const day = (week - 1) * 7 + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** The four week buckets, for a picker on the monthly entry sheet. */
export const WEEK_OPTIONS = ["WEEK 1", "WEEK 2", "WEEK 3", "WEEK 4"] as const;

// ── Months as the books use them ─────────────────────────────────────────
//
// "August 2026", not a timestamp. The workbook is organised one file per
// month, and the worst bug this code could have is a month boundary that
// shifts under a timezone — so year and month are carried as integers and
// only turned into Dates at the edge, always in UTC.

export interface Period {
  year: number;
  /** 1-12. Not 0-indexed — a business month, not a JS Date field. */
  month: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** URL form: "2026-08". Sortable as a string, unambiguous, no locale. */
export function formatPeriodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function parsePeriodKey(value: string | undefined | null): Period | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  // The regex already forces four digits; this rejects the absurd ends of
  // that range rather than letting year 0999 through.
  if (year < 2000 || year > 2100) return null;
  return { year, month };
}

export function periodLabel(p: Period): string {
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

export function periodShortLabel(p: Period): string {
  return `${MONTH_NAMES[p.month - 1].slice(0, 3)} ${p.year}`;
}

/**
 * The range covering this month, in UTC. `to` is the last millisecond of
 * the month rather than the first of the next, matching how the existing
 * range filters are written (gte/lte).
 */
export function periodRange(p: Period): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(p.year, p.month - 1, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(p.year, p.month, 0, 23, 59, 59, 999)),
  };
}

/** Default date for a new row: the 1st of the month being edited. */
export function periodFirstDay(p: Period): Date {
  return new Date(Date.UTC(p.year, p.month - 1, 1));
}

export function periodFromDate(date: Date): Period {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function currentPeriod(now: Date = new Date()): Period {
  return periodFromDate(now);
}

/** Newest first — the month someone wants is almost always a recent one. */
export function comparePeriodsDesc(a: Period, b: Period): number {
  return b.year - a.year || b.month - a.month;
}

export function periodsEqual(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

/** The month after this one, rolling the year over at December. */
export function nextPeriod(p: Period): Period {
  return p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 };
}
