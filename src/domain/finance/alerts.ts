import { Prisma } from "@prisma/client";
import type { TransactionStatus } from "@prisma/client";

const { Decimal } = Prisma;

/**
 * Ageing + alert rules.
 *
 * Pure: no Prisma, no session, no clock of its own — `today` is always
 * passed in. That keeps every threshold directly testable and stops the
 * results drifting depending on when the dashboard happens to render.
 */

export type AgeingBucket = "CURRENT" | "DUE_0_30" | "DUE_31_60" | "DUE_61_90" | "DUE_90_PLUS";

export const AGEING_BUCKET_LABEL: Record<AgeingBucket, string> = {
  CURRENT: "Not yet due",
  DUE_0_30: "1–30 days",
  DUE_31_60: "31–60 days",
  DUE_61_90: "61–90 days",
  DUE_90_PLUS: "90+ days",
};

/** Whole days elapsed between two dates, floored, using UTC day boundaries. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Buckets by how long something has been outstanding.
 *
 * `age <= 0` is CURRENT: a transaction dated today (or future-dated) hasn't
 * aged yet. The first overdue bucket therefore starts at day 1, which is why
 * its label reads "1–30 days" rather than "0–30".
 */
export function ageingBucket(transactionDate: Date, today: Date): AgeingBucket {
  const age = daysBetween(transactionDate, today);
  if (age <= 0) return "CURRENT";
  if (age <= 30) return "DUE_0_30";
  if (age <= 60) return "DUE_31_60";
  if (age <= 90) return "DUE_61_90";
  return "DUE_90_PLUS";
}

export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Severity for an unsettled item.
 *
 * A fully PAID item never raises an alert regardless of age — that's the
 * single most important rule here, since an old-but-settled transaction is
 * not a problem and must never appear as one.
 */
export function alertSeverity(status: TransactionStatus, transactionDate: Date, today: Date): AlertSeverity | null {
  if (status === "PAID") return null;
  const bucket = ageingBucket(transactionDate, today);
  switch (bucket) {
    case "CURRENT":
      return null;
    case "DUE_0_30":
      return "info";
    case "DUE_31_60":
      return "warning";
    default:
      return "critical";
  }
}

export interface AgeableItem {
  transactionDate: Date;
  status: TransactionStatus;
  /** Amount still outstanding — already computed as due minus paid. */
  outstanding: Prisma.Decimal;
}

export interface AgeingSummaryRow {
  bucket: AgeingBucket;
  label: string;
  count: number;
  total: Prisma.Decimal;
}

const ORDER: AgeingBucket[] = ["CURRENT", "DUE_0_30", "DUE_31_60", "DUE_61_90", "DUE_90_PLUS"];

/**
 * Groups outstanding items into ageing buckets.
 *
 * Settled items and anything with nothing left to pay are excluded up front,
 * so a bucket's total is always money genuinely still owed. Every bucket is
 * returned even when empty — a table that changes shape as data arrives is
 * harder to read than one with explicit zeros.
 */
export function summariseAgeing(items: readonly AgeableItem[], today: Date): AgeingSummaryRow[] {
  const buckets = new Map<AgeingBucket, { count: number; total: Prisma.Decimal }>(
    ORDER.map((b) => [b, { count: 0, total: new Decimal(0) }])
  );

  for (const item of items) {
    if (item.status === "PAID") continue;
    if (item.outstanding.lte(0)) continue;
    const entry = buckets.get(ageingBucket(item.transactionDate, today))!;
    entry.count += 1;
    entry.total = entry.total.plus(item.outstanding);
  }

  return ORDER.map((bucket) => ({
    bucket,
    label: AGEING_BUCKET_LABEL[bucket],
    count: buckets.get(bucket)!.count,
    total: buckets.get(bucket)!.total,
  }));
}

/** Total genuinely overdue (excludes CURRENT, which isn't late yet). */
export function totalOverdue(rows: readonly AgeingSummaryRow[]): Prisma.Decimal {
  return rows
    .filter((r) => r.bucket !== "CURRENT")
    .reduce((sum, r) => sum.plus(r.total), new Decimal(0));
}
