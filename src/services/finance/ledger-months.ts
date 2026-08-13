import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type Period,
  formatPeriodKey,
  periodFromDate,
  periodRange,
  comparePeriodsDesc,
} from "@/domain/finance/period";

const { Decimal } = Prisma;

export interface MonthSummary extends Period {
  key: string;
  /** Outflow: total due. Inflow: total deal value. */
  total: Prisma.Decimal;
  /** Settled portion — paid out, or collected in. */
  settled: Prisma.Decimal;
  /** total - settled. */
  outstanding: Prisma.Decimal;
  rowCount: number;
  /** True when the month exists only as an explicitly created empty shell. */
  isEmpty: boolean;
}

/**
 * Every month that should appear as a card, newest first.
 *
 * The union of two sources: months that already contain rows (so importing
 * a workbook or seeding data surfaces its months without anyone pressing
 * "create"), and months explicitly created but still empty. Deriving alone
 * would make a freshly created month vanish; the table alone would hide
 * every month that arrived through the importer.
 */
export async function listMonths(
  entityId: string,
  transactionType: "INFLOW" | "OUTFLOW"
): Promise<MonthSummary[]> {
  const [created, rows] = await Promise.all([
    prisma.ledgerMonth.findMany({
      where: { entityId },
      select: { year: true, month: true },
    }),
    // Grouped in SQL rather than pulled into memory: a year of daily entries
    // is thousands of rows, and only the per-month totals are wanted.
    prisma.$queryRaw<{ year: number; month: number; total: string; settled: string; count: bigint }[]>`
      SELECT
        EXTRACT(YEAR  FROM t."transactionDate")::int  AS year,
        EXTRACT(MONTH FROM t."transactionDate")::int  AS month,
        COALESCE(SUM(t."originalAmount"), 0)::text    AS total,
        COALESCE(SUM(t."paidAmount"), 0)::text        AS settled,
        COUNT(*)                                      AS count
      FROM "FinancialTransaction" t
      WHERE t."entityId" = ${entityId}
        AND t."transactionType"::text = ${transactionType}
      GROUP BY 1, 2
    `,
  ]);

  const byKey = new Map<string, MonthSummary>();

  for (const r of rows) {
    const period = { year: r.year, month: r.month };
    const total = new Decimal(r.total);
    const settled = new Decimal(r.settled);
    byKey.set(formatPeriodKey(period), {
      ...period,
      key: formatPeriodKey(period),
      total,
      settled,
      outstanding: total.minus(settled),
      rowCount: Number(r.count),
      isEmpty: false,
    });
  }

  for (const c of created) {
    const period = { year: c.year, month: c.month };
    const key = formatPeriodKey(period);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      ...period,
      key,
      total: new Decimal(0),
      settled: new Decimal(0),
      outstanding: new Decimal(0),
      rowCount: 0,
      isEmpty: true,
    });
  }

  return [...byKey.values()].sort(comparePeriodsDesc);
}

export interface MonthTotals {
  total: Prisma.Decimal;
  settled: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  /** settled / total, 0 when nothing is due. */
  settledFraction: Prisma.Decimal;
  rowCount: number;
}

/**
 * The figures the workbook prints in its LIVE TOTALS row, for one month.
 *
 * Computed from the rows rather than stored, so they cannot drift the way
 * the spreadsheet's hand-maintained summary cells could.
 */
export async function getMonthTotals(
  entityId: string,
  transactionType: "INFLOW" | "OUTFLOW",
  period: Period
): Promise<MonthTotals> {
  const range = periodRange(period);
  const agg = await prisma.financialTransaction.aggregate({
    where: {
      entityId,
      transactionType,
      transactionDate: { gte: range.from, lte: range.to },
    },
    _sum: { originalAmount: true, paidAmount: true },
    _count: true,
  });

  const total = agg._sum.originalAmount ?? new Decimal(0);
  const settled = agg._sum.paidAmount ?? new Decimal(0);
  return {
    total,
    settled,
    outstanding: total.minus(settled),
    settledFraction: total.eq(0) ? new Decimal(0) : settled.div(total),
    rowCount: agg._count,
  };
}

/** Months already holding rows — used to pre-fill the "create month" picker. */
export async function existingPeriodKeys(entityId: string): Promise<Set<string>> {
  const [months, dates] = await Promise.all([
    prisma.ledgerMonth.findMany({ where: { entityId }, select: { year: true, month: true } }),
    prisma.financialTransaction.findMany({
      where: { entityId },
      select: { transactionDate: true },
      distinct: ["transactionDate"],
    }),
  ]);
  const keys = new Set<string>();
  for (const m of months) keys.add(formatPeriodKey({ year: m.year, month: m.month }));
  for (const d of dates) keys.add(formatPeriodKey(periodFromDate(d.transactionDate)));
  return keys;
}
