/**
 * Parses a `<input type="date">` value ("YYYY-MM-DD") as UTC midnight.
 * All transaction/payment dates are stored @db.Date — pure calendar dates
 * with no time-of-day or timezone component, so there's no "which entity's
 * timezone" ambiguity to resolve between UAE and India.
 */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
