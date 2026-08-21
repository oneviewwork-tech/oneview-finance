import { Prisma } from "@prisma/client";
import type { Currency } from "@prisma/client";

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  AED: "en-AE",
  INR: "en-IN",
};

/**
 * Full-precision currency formatting for detail views — "AED 5,000.00" /
 * "₹1,25,000.00" (Indian digit grouping via the en-IN locale). Never emits
 * bare "INR 125000.000000" — the spec explicitly forbids that.
 */
export function formatMoney(amount: Prisma.Decimal | number | string, currency: Currency): string {
  const value = amount instanceof Prisma.Decimal ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Compact notation for dashboard tiles — "₹12.5L" / "AED 1.4M". Detail
 * views must use formatMoney instead; this is for large summary numbers
 * only (Financial Intelligence, Phase 4).
 */
export function formatMoneyCompact(amount: Prisma.Decimal | number | string, currency: Currency): string {
  const value = amount instanceof Prisma.Decimal ? amount.toNumber() : Number(amount);
  if (currency === "INR") {
    const abs = Math.abs(value);
    if (abs >= 1_00_00_000) return `${sign(value)}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${sign(value)}₹${(abs / 1_00_000).toFixed(2)}L`;
    return formatMoney(value, currency);
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign(value)}AED ${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign(value)}AED ${(abs / 1_000).toFixed(1)}K`;
  return formatMoney(value, currency);
}

function sign(value: number): string {
  return value < 0 ? "-" : "";
}

export function formatPercent(fraction: Prisma.Decimal | number): string {
  const value = fraction instanceof Prisma.Decimal ? fraction.toNumber() : fraction;
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

// A trailing comparison window can land on a period whose baseline was
// nearly nothing, which makes a genuine, correctly-computed swing print as
// an alarming five-digit percentage — "1556.9%" reads as a rendering bug
// even though the arithmetic is exact. Capped here, in display only: the
// underlying percentChange stays exact for anything reading it directly,
// only the printed string is bounded.
const DELTA_DISPLAY_CAP = 999;

export function formatDeltaPercent(percentChange: number): string {
  const pct = Math.abs(percentChange * 100);
  return pct > DELTA_DISPLAY_CAP ? `>${DELTA_DISPLAY_CAP}%` : `${pct.toFixed(1)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}
