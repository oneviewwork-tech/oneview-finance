import { Prisma } from "@prisma/client";
import type { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import { calculateCollectedFraction, calculateStatus } from "@/domain/finance/calculations";

const { Decimal } = Prisma;

function rangeFilter(range?: DateRange) {
  if (!range) return undefined;
  return { gte: range.from, lte: range.to };
}

// ── Inflow summary — mirrors the Dashboard's "INFLOW SUMMARY" block ──

export interface InflowSummary {
  totalDealValue: Prisma.Decimal;
  totalReceived: Prisma.Decimal;
  balanceReceivable: Prisma.Decimal;
  collectionRate: Prisma.Decimal;
  clientsClosed: number;
  newClientsClosed: number;
  existingOrRepeatClientsClosed: number;
  averageDealSize: Prisma.Decimal;
}

export async function getInflowSummary(entityId: string, range?: DateRange): Promise<InflowSummary> {
  const where = {
    entityId,
    transactionType: "INFLOW" as const,
    transactionDate: rangeFilter(range),
  };

  const [agg, clientsClosed, newClientsClosed] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where,
      _sum: { originalAmount: true, paidAmount: true },
    }),
    prisma.financialTransaction.count({ where }),
    prisma.financialTransaction.count({
      where: { ...where, client: { clientType: { name: "New Client" } } },
    }),
  ]);

  const totalDealValue = agg._sum.originalAmount ?? new Decimal(0);
  const totalReceived = agg._sum.paidAmount ?? new Decimal(0);

  return {
    totalDealValue,
    totalReceived,
    balanceReceivable: totalDealValue.minus(totalReceived),
    collectionRate: calculateCollectedFraction(totalDealValue, totalReceived),
    clientsClosed,
    newClientsClosed,
    existingOrRepeatClientsClosed: clientsClosed - newClientsClosed,
    averageDealSize: clientsClosed === 0 ? new Decimal(0) : totalDealValue.div(clientsClosed),
  };
}

// ── Outflow summary — mirrors the Dashboard's TOTAL OUTFLOW/PAID/PENDING ──

export interface OutflowSummary {
  totalDue: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  totalPending: Prisma.Decimal;
  percentSettled: Prisma.Decimal;
  itemCount: number;
}

export async function getOutflowSummary(entityId: string, range?: DateRange): Promise<OutflowSummary> {
  const where = {
    entityId,
    transactionType: "OUTFLOW" as const,
    transactionDate: rangeFilter(range),
  };

  const [agg, itemCount] = await Promise.all([
    prisma.financialTransaction.aggregate({ where, _sum: { originalAmount: true, paidAmount: true } }),
    prisma.financialTransaction.count({ where }),
  ]);

  const totalDue = agg._sum.originalAmount ?? new Decimal(0);
  const totalPaid = agg._sum.paidAmount ?? new Decimal(0);

  return {
    totalDue,
    totalPaid,
    totalPending: totalDue.minus(totalPaid),
    percentSettled: calculateCollectedFraction(totalDue, totalPaid),
    itemCount,
  };
}

// ── Net Position — Inflow received minus Outflow paid (NOT "profit") ──

export interface NetPositionSummary {
  totalInflow: Prisma.Decimal;
  outflowPaid: Prisma.Decimal;
  netPosition: Prisma.Decimal;
}

export async function getNetPosition(entityId: string, range?: DateRange): Promise<NetPositionSummary> {
  const [inflow, outflow] = await Promise.all([getInflowSummary(entityId, range), getOutflowSummary(entityId, range)]);
  return {
    totalInflow: inflow.totalReceived,
    outflowPaid: outflow.totalPaid,
    netPosition: inflow.totalReceived.minus(outflow.totalPaid),
  };
}

// ── Receivables — open (not-fully-collected) inflow transactions ──

export interface ReceivableRow {
  transactionId: string;
  clientName: string;
  description: string;
  dealValue: Prisma.Decimal;
  received: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  collectedFraction: Prisma.Decimal;
  transactionDate: Date;
}

export interface ReceivablesResult {
  totalReceivables: Prisma.Decimal;
  rows: ReceivableRow[];
}

export async function getReceivables(entityId: string, range?: DateRange): Promise<ReceivablesResult> {
  const where = {
    entityId,
    transactionType: "INFLOW" as const,
    transactionDate: rangeFilter(range),
  };

  const [agg, openTransactions] = await Promise.all([
    prisma.financialTransaction.aggregate({ where, _sum: { originalAmount: true, paidAmount: true } }),
    prisma.financialTransaction.findMany({
      where: { ...where, status: { not: "PAID" } },
      include: { client: true },
      orderBy: { transactionDate: "desc" },
    }),
  ]);

  const totalDealValue = agg._sum.originalAmount ?? new Decimal(0);
  const totalReceived = agg._sum.paidAmount ?? new Decimal(0);

  return {
    totalReceivables: totalDealValue.minus(totalReceived),
    rows: openTransactions.map((t) => ({
      transactionId: t.id,
      clientName: t.client?.name ?? "—",
      description: t.description,
      dealValue: t.originalAmount,
      received: t.paidAmount,
      balanceDue: t.originalAmount.minus(t.paidAmount),
      collectedFraction: calculateCollectedFraction(t.originalAmount, t.paidAmount),
      transactionDate: t.transactionDate,
    })),
  };
}

// ── Category summary — with WEEK 1-4 breakdown (raw SQL: week bucketing
// isn't expressible through Prisma's query builder, and this is exactly
// the kind of grouped aggregation the spec says belongs in Postgres, not
// fetched row-by-row into Node). ──

export interface CategorySummaryRow {
  categoryId: string;
  categoryName: string;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  percentPaid: Prisma.Decimal;
  week1: Prisma.Decimal;
  week2: Prisma.Decimal;
  week3: Prisma.Decimal;
  week4: Prisma.Decimal;
}

interface CategorySummaryQueryRow {
  categoryId: string;
  categoryName: string;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  week1: Prisma.Decimal;
  week2: Prisma.Decimal;
  week3: Prisma.Decimal;
  week4: Prisma.Decimal;
}

export async function getCategorySummary(entityId: string, range?: DateRange): Promise<CategorySummaryRow[]> {
  // Omit the date predicate entirely for an unbounded query rather than
  // reaching for sentinel dates. `new Date(8640000000000000)` (max JS date)
  // was the previous upper bound and Prisma cannot serialise it into a raw
  // query at all — so the all-time path threw. Every caller until now passed
  // a range, which is why it went unnoticed.
  const dateFilter = range
    ? Prisma.sql`AND t."transactionDate" BETWEEN ${range.from} AND ${range.to}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<CategorySummaryQueryRow[]>(Prisma.sql`
    SELECT
      c.id AS "categoryId",
      c.name AS "categoryName",
      COALESCE(SUM(t."originalAmount"), 0) AS "totalDue",
      COALESCE(SUM(t."paidAmount"), 0) AS "paid",
      COALESCE(SUM(t."originalAmount") FILTER (
        WHERE LEAST(4, CEIL(EXTRACT(DAY FROM t."transactionDate")::numeric / 7))::int = 1
      ), 0) AS "week1",
      COALESCE(SUM(t."originalAmount") FILTER (
        WHERE LEAST(4, CEIL(EXTRACT(DAY FROM t."transactionDate")::numeric / 7))::int = 2
      ), 0) AS "week2",
      COALESCE(SUM(t."originalAmount") FILTER (
        WHERE LEAST(4, CEIL(EXTRACT(DAY FROM t."transactionDate")::numeric / 7))::int = 3
      ), 0) AS "week3",
      COALESCE(SUM(t."originalAmount") FILTER (
        WHERE LEAST(4, CEIL(EXTRACT(DAY FROM t."transactionDate")::numeric / 7))::int = 4
      ), 0) AS "week4"
    FROM "FinancialCategory" c
    LEFT JOIN "FinancialTransaction" t
      ON t."categoryId" = c.id
      AND t."entityId" = ${entityId}
      AND t."transactionType" = 'OUTFLOW'
      ${dateFilter}
    WHERE c."isActive" = true
    GROUP BY c.id, c.name, c."sortOrder"
    ORDER BY c."sortOrder"
  `);

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    totalDue: r.totalDue,
    paid: r.paid,
    pending: r.totalDue.minus(r.paid),
    percentPaid: calculateCollectedFraction(r.totalDue, r.paid),
    week1: r.week1,
    week2: r.week2,
    week3: r.week3,
    week4: r.week4,
  }));
}

// ── Weekly summary — by week (1-4, raw SQL bucketing), by Type, by Status ──

export interface WeeklyBucket {
  week: 1 | 2 | 3 | 4;
  items: number;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  percentPaid: Prisma.Decimal;
  percentOfMonth: Prisma.Decimal;
}

export interface WeeklySummaryByType {
  expenseTypeName: string;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  percentPaid: Prisma.Decimal;
}

export interface WeeklySummaryByStatus {
  status: TransactionStatus;
  items: number;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
}

export interface WeeklySummaryResult {
  weeks: WeeklyBucket[];
  byType: WeeklySummaryByType[];
  byStatus: WeeklySummaryByStatus[];
}

interface WeekBucketQueryRow {
  week: number;
  items: bigint;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
}

export async function getWeeklySummary(entityId: string, range: DateRange): Promise<WeeklySummaryResult> {
  const [weekRows, typeGroups, expenseTypes, statusGroups] = await Promise.all([
    prisma.$queryRaw<WeekBucketQueryRow[]>(Prisma.sql`
      SELECT
        LEAST(4, CEIL(EXTRACT(DAY FROM "transactionDate")::numeric / 7))::int AS week,
        COUNT(*) AS items,
        COALESCE(SUM("originalAmount"), 0) AS "totalDue",
        COALESCE(SUM("paidAmount"), 0) AS paid
      FROM "FinancialTransaction"
      WHERE "entityId" = ${entityId}
        AND "transactionType" = 'OUTFLOW'
        AND "transactionDate" BETWEEN ${range.from} AND ${range.to}
      GROUP BY week
      ORDER BY week
    `),
    prisma.financialTransaction.groupBy({
      by: ["expenseTypeId"],
      where: {
        entityId,
        transactionType: "OUTFLOW",
        transactionDate: { gte: range.from, lte: range.to },
        expenseTypeId: { not: null },
      },
      _sum: { originalAmount: true, paidAmount: true },
    }),
    prisma.expenseType.findMany(),
    prisma.financialTransaction.groupBy({
      by: ["status"],
      where: { entityId, transactionType: "OUTFLOW", transactionDate: { gte: range.from, lte: range.to } },
      _sum: { originalAmount: true, paidAmount: true },
      _count: true,
    }),
  ]);

  const grandTotalDue = weekRows.reduce((sum, r) => sum.plus(r.totalDue), new Decimal(0));

  const weekByNumber = new Map(weekRows.map((r) => [r.week, r]));
  const weeks: WeeklyBucket[] = [1, 2, 3, 4].map((week) => {
    const row = weekByNumber.get(week);
    const totalDue = row?.totalDue ?? new Decimal(0);
    const paid = row?.paid ?? new Decimal(0);
    return {
      week: week as 1 | 2 | 3 | 4,
      items: row ? Number(row.items) : 0,
      totalDue,
      paid,
      pending: totalDue.minus(paid),
      percentPaid: calculateCollectedFraction(totalDue, paid),
      percentOfMonth: calculateCollectedFraction(grandTotalDue, totalDue),
    };
  });

  const expenseTypeNameById = new Map(expenseTypes.map((et) => [et.id, et.name]));
  const byType: WeeklySummaryByType[] = typeGroups.map((g) => {
    const totalDue = g._sum.originalAmount ?? new Decimal(0);
    const paid = g._sum.paidAmount ?? new Decimal(0);
    return {
      expenseTypeName: expenseTypeNameById.get(g.expenseTypeId!) ?? "—",
      totalDue,
      paid,
      pending: totalDue.minus(paid),
      percentPaid: calculateCollectedFraction(totalDue, paid),
    };
  });

  const byStatus: WeeklySummaryByStatus[] = statusGroups.map((g) => {
    const totalDue = g._sum.originalAmount ?? new Decimal(0);
    const paid = g._sum.paidAmount ?? new Decimal(0);
    return {
      status: g.status,
      items: g._count,
      totalDue,
      paid,
      pending: totalDue.minus(paid),
    };
  });

  return { weeks, byType, byStatus };
}

// ── Monthly summary — multi-month trend per entity, for period comparison ──

export interface MonthlySummaryRow {
  monthKey: string;
  totalInflow: Prisma.Decimal;
  totalOutflowDue: Prisma.Decimal;
  outflowPaid: Prisma.Decimal;
  outflowPending: Prisma.Decimal;
  netPosition: Prisma.Decimal;
}

interface MonthlyQueryRow {
  monthKey: string;
  transactionType: "INFLOW" | "OUTFLOW";
  totalAmount: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
}

// Callers only ever use the trailing 12 months (see intelligence/page.tsx's
// .slice(-12) / .slice(-6)) — bounding the query to a generous 24-month
// window keeps this a fast indexed range scan instead of an unbounded
// full-history aggregation that gets slower every month the app is in use.
const MONTHLY_SUMMARY_LOOKBACK_MONTHS = 24;

export async function getMonthlySummary(entityId: string): Promise<MonthlySummaryRow[]> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - MONTHLY_SUMMARY_LOOKBACK_MONTHS, 1);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<MonthlyQueryRow[]>(Prisma.sql`
    SELECT
      TO_CHAR(date_trunc('month', "transactionDate"), 'YYYY-MM') AS "monthKey",
      "transactionType",
      COALESCE(SUM("originalAmount"), 0) AS "totalAmount",
      COALESCE(SUM("paidAmount"), 0) AS "totalPaid"
    FROM "FinancialTransaction"
    WHERE "entityId" = ${entityId} AND "transactionDate" >= ${since}
    GROUP BY "monthKey", "transactionType"
    ORDER BY "monthKey"
  `);

  const byMonth = new Map<string, MonthlySummaryRow>();
  for (const row of rows) {
    const entry = byMonth.get(row.monthKey) ?? {
      monthKey: row.monthKey,
      totalInflow: new Decimal(0),
      totalOutflowDue: new Decimal(0),
      outflowPaid: new Decimal(0),
      outflowPending: new Decimal(0),
      netPosition: new Decimal(0),
    };
    if (row.transactionType === "INFLOW") {
      entry.totalInflow = entry.totalInflow.plus(row.totalPaid);
    } else {
      entry.totalOutflowDue = entry.totalOutflowDue.plus(row.totalAmount);
      entry.outflowPaid = entry.outflowPaid.plus(row.totalPaid);
    }
    byMonth.set(row.monthKey, entry);
  }

  return Array.from(byMonth.values())
    .map((entry) => ({
      ...entry,
      outflowPending: entry.totalOutflowDue.minus(entry.outflowPaid),
      netPosition: entry.totalInflow.minus(entry.outflowPaid),
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

// ── Entity summary — UAE and India side by side, each in native currency.
// Never summed together here — combining currencies is explicitly a Phase 4
// concern once the FX conversion layer exists. ──

export interface EntitySummaryRow {
  entityId: string;
  entityCode: string;
  entityName: string;
  currency: string;
  totalInflow: Prisma.Decimal;
  totalOutflowDue: Prisma.Decimal;
  outflowPaid: Prisma.Decimal;
  outflowPending: Prisma.Decimal;
  receivables: Prisma.Decimal;
  netPosition: Prisma.Decimal;
  clientsClosed: number;
}

export async function getEntitySummary(range?: DateRange): Promise<EntitySummaryRow[]> {
  const entities = await prisma.businessEntity.findMany({ orderBy: { code: "asc" } });

  return Promise.all(
    entities.map(async (entity) => {
      const [inflow, outflow] = await Promise.all([
        getInflowSummary(entity.id, range),
        getOutflowSummary(entity.id, range),
      ]);
      return {
        entityId: entity.id,
        entityCode: entity.code,
        entityName: entity.name,
        currency: entity.baseCurrency,
        totalInflow: inflow.totalReceived,
        totalOutflowDue: outflow.totalDue,
        outflowPaid: outflow.totalPaid,
        outflowPending: outflow.totalPending,
        receivables: inflow.balanceReceivable,
        netPosition: inflow.totalReceived.minus(outflow.totalPaid),
        clientsClosed: inflow.clientsClosed,
      };
    })
  );
}

// ── Dashboard overview — the workbook's exact top-level KPI set, for one entity ──

export interface DashboardOverview {
  totalInflowReceived: Prisma.Decimal;
  totalOutflowDue: Prisma.Decimal;
  outflowPaid: Prisma.Decimal;
  outflowPending: Prisma.Decimal;
  netPosition: Prisma.Decimal;
  percentOutflowSettled: Prisma.Decimal;
  receivables: Prisma.Decimal;
  clientsClosed: number;
}

export async function getDashboardOverview(entityId: string, range?: DateRange): Promise<DashboardOverview> {
  const [inflow, outflow] = await Promise.all([getInflowSummary(entityId, range), getOutflowSummary(entityId, range)]);

  return {
    totalInflowReceived: inflow.totalReceived,
    totalOutflowDue: outflow.totalDue,
    outflowPaid: outflow.totalPaid,
    outflowPending: outflow.totalPending,
    netPosition: inflow.totalReceived.minus(outflow.totalPaid),
    percentOutflowSettled: outflow.percentSettled,
    receivables: inflow.balanceReceivable,
    clientsClosed: inflow.clientsClosed,
  };
}

// ── Department payment status — not in the source workbook. Answers "of N
// departments with activity this period, how many are fully paid, and which
// are delayed?" Only departments with at least one tagged Outflow row in the
// range appear; untagged transactions aren't attributable to any department. ──

export interface DepartmentStatusRow {
  departmentId: string;
  departmentName: string;
  totalDue: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  percentPaid: Prisma.Decimal;
  itemCount: number;
  paidItemCount: number;
  partialItemCount: number;
  pendingItemCount: number;
  fullyPaid: boolean;
}

export async function getDepartmentPaymentStatus(entityId: string, range?: DateRange): Promise<DepartmentStatusRow[]> {
  const where = {
    entityId,
    transactionType: "OUTFLOW" as const,
    departmentId: { not: null },
    transactionDate: rangeFilter(range),
  };

  const [totals, statusGroups, departments] = await Promise.all([
    prisma.financialTransaction.groupBy({
      by: ["departmentId"],
      where,
      _sum: { originalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.financialTransaction.groupBy({
      by: ["departmentId", "status"],
      where,
      _count: true,
    }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const totalsByDept = new Map(totals.map((t) => [t.departmentId!, t]));
  const statusByDept = new Map<string, Record<TransactionStatus, number>>();
  for (const g of statusGroups) {
    const key = g.departmentId!;
    const entry = statusByDept.get(key) ?? { PAID: 0, PARTIAL: 0, PENDING: 0 };
    entry[g.status] = g._count;
    statusByDept.set(key, entry);
  }

  return departments
    .map((dept) => {
      const t = totalsByDept.get(dept.id);
      const totalDue = t?._sum.originalAmount ?? new Decimal(0);
      const paid = t?._sum.paidAmount ?? new Decimal(0);
      const itemCount = t?._count ?? 0;
      const statusCounts = statusByDept.get(dept.id) ?? { PAID: 0, PARTIAL: 0, PENDING: 0 };
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalDue,
        paid,
        pending: totalDue.minus(paid),
        percentPaid: calculateCollectedFraction(totalDue, paid),
        itemCount,
        paidItemCount: statusCounts.PAID,
        partialItemCount: statusCounts.PARTIAL,
        pendingItemCount: statusCounts.PENDING,
        fullyPaid: itemCount > 0 && statusCounts.PAID === itemCount,
      };
    })
    .filter((row) => row.itemCount > 0);
}

// Re-exported so callers can double-check a single row's status without a
// second round trip — same rule the row-level Payment Tracker uses.
export { calculateStatus };
