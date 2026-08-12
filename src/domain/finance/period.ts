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
