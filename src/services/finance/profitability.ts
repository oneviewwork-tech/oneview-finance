import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import {
  SALARY_CATEGORY_NAMES,
  computeProfitability,
  summarisePaymentLag,
  type Profitability,
  type PaymentLagSummary,
} from "@/domain/finance/profitability";
import { getInflowSummary, getOutflowSummary } from "./summary";

const { Decimal } = Prisma;

function rangeFilter(range?: DateRange) {
  if (!range) return undefined;
  return { gte: range.from, lte: range.to };
}

// ── Salary ──────────────────────────────────────────────────────────────

export interface SalaryDepartmentRow {
  departmentId: string | null;
  departmentName: string;
  due: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  headcountRows: number;
}

export interface SalarySummary {
  due: Prisma.Decimal;
  paid: Prisma.Decimal;
  pending: Prisma.Decimal;
  settledFraction: Prisma.Decimal;
  rowCount: number;
  /** Share of all outflow paid that went on payroll. */
  shareOfOutflow: Prisma.Decimal;
  byDepartment: SalaryDepartmentRow[];
}

/**
 * What the entity spends on payroll, and where it lands.
 *
 * Untagged rows are reported under "Unassigned" rather than dropped: unlike
 * the department performance panel — which is explicitly about attributable
 * work — a salary total that quietly omitted untagged payroll would be
 * wrong, not merely partial.
 */
export async function getSalarySummary(entityId: string, range?: DateRange): Promise<SalarySummary> {
  const where = {
    entityId,
    transactionType: "OUTFLOW" as const,
    transactionDate: rangeFilter(range),
    category: { name: { in: [...SALARY_CATEGORY_NAMES] } },
  };

  const [agg, grouped, departments, outflow] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where,
      _sum: { originalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.financialTransaction.groupBy({
      by: ["departmentId"],
      where,
      _sum: { originalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
    getOutflowSummary(entityId, range),
  ]);

  const nameById = new Map(departments.map((d) => [d.id, d.name]));

  const byDepartment = grouped
    .map((g) => {
      const due = g._sum.originalAmount ?? new Decimal(0);
      const paid = g._sum.paidAmount ?? new Decimal(0);
      return {
        departmentId: g.departmentId,
        departmentName: g.departmentId ? nameById.get(g.departmentId) ?? "Unknown" : "Unassigned",
        due,
        paid,
        pending: due.minus(paid),
        headcountRows: g._count,
      };
    })
    .sort((a, b) => b.due.comparedTo(a.due));

  const due = agg._sum.originalAmount ?? new Decimal(0);
  const paid = agg._sum.paidAmount ?? new Decimal(0);

  return {
    due,
    paid,
    pending: due.minus(paid),
    settledFraction: due.eq(0) ? new Decimal(0) : paid.div(due),
    rowCount: agg._count,
    shareOfOutflow: outflow.totalPaid.eq(0) ? new Decimal(0) : paid.div(outflow.totalPaid),
    byDepartment,
  };
}

// ── Profit / loss ───────────────────────────────────────────────────────

export interface ProfitabilitySummary extends Profitability {
  /** The payroll slice of expenses, for context on the detail page. */
  salaryPaid: Prisma.Decimal;
  /** Everything paid that wasn't payroll. */
  otherExpensesPaid: Prisma.Decimal;
}

/**
 * Cash-basis profitability: revenue received (net of tax) less expenses
 * paid. Uses getInflowSummary's already-netted totalReceived so tax is
 * excluded here by construction rather than by a second, drifting rule.
 */
export async function getProfitability(entityId: string, range?: DateRange): Promise<ProfitabilitySummary> {
  const [inflow, outflow, salary] = await Promise.all([
    getInflowSummary(entityId, range),
    getOutflowSummary(entityId, range),
    getSalarySummary(entityId, range),
  ]);

  const base = computeProfitability(inflow.totalReceived, outflow.totalPaid);
  return {
    ...base,
    salaryPaid: salary.paid,
    otherExpensesPaid: outflow.totalPaid.minus(salary.paid),
  };
}

// ── How fast clients pay ────────────────────────────────────────────────

export interface PaymentLagClientRow {
  transactionId: string;
  clientName: string;
  description: string;
  startedOn: Date;
  firstPaidOn: Date | null;
  days: number | null;
  dealValue: Prisma.Decimal;
}

export interface PaymentLagResult extends PaymentLagSummary {
  rows: PaymentLagClientRow[];
}

/**
 * How long clients take to pay, measured from the deal date to the first
 * receipt against it.
 *
 * First receipt rather than full settlement on purpose: it answers "how long
 * before money starts arriving", which is the cash-flow question. Waiting for
 * full payment would leave every part-paid deal permanently uncounted.
 */
export async function getPaymentLag(entityId: string, range?: DateRange): Promise<PaymentLagResult> {
  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId,
      transactionType: "INFLOW",
      transactionDate: rangeFilter(range),
    },
    include: {
      client: true,
      // Earliest payment only — the question is when money first arrived.
      payments: { orderBy: { paymentDate: "asc" }, take: 1 },
    },
    orderBy: { transactionDate: "desc" },
  });

  const inputs = transactions.map((t) => ({
    startedOn: t.transactionDate,
    firstPaidOn: t.payments[0]?.paymentDate ?? null,
  }));

  const summary = summarisePaymentLag(inputs);

  const rows: PaymentLagClientRow[] = transactions.map((t, i) => {
    const firstPaidOn = inputs[i].firstPaidOn;
    return {
      transactionId: t.id,
      clientName: t.client?.name ?? "—",
      description: t.description,
      startedOn: t.transactionDate,
      firstPaidOn,
      days: firstPaidOn
        ? Math.max(0, Math.round((firstPaidOn.getTime() - t.transactionDate.getTime()) / 86_400_000))
        : null,
      dealValue: t.originalAmount,
    };
  });

  // Slowest first: the late payers are the reason anyone opens this page.
  rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return { ...summary, rows };
}
