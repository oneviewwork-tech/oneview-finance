import { Prisma } from "@prisma/client";
import type { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  alertSeverity,
  daysBetween,
  summariseAgeing,
  totalOverdue,
  type AgeingSummaryRow,
  type AlertSeverity,
} from "@/domain/finance/alerts";

const { Decimal } = Prisma;

export interface OverdueItem {
  transactionId: string;
  description: string;
  counterparty: string;
  transactionDate: Date;
  daysOverdue: number;
  outstanding: Prisma.Decimal;
  status: TransactionStatus;
  severity: AlertSeverity;
}

export interface AlertsResult {
  /** Money owed TO us (unpaid inflow) — receivables ageing. */
  receivablesAgeing: AgeingSummaryRow[];
  receivablesOverdue: Prisma.Decimal;
  /** Money we owe (unpaid outflow) — payables ageing. */
  payablesAgeing: AgeingSummaryRow[];
  payablesOverdue: Prisma.Decimal;
  /** The worst offenders on each side, for a "needs attention" list. */
  topOverdueReceivables: OverdueItem[];
  topOverduePayables: OverdueItem[];
}

/**
 * Ageing is deliberately NOT scoped to the dashboard's selected period.
 *
 * An invoice raised four months ago is still overdue today; filtering it out
 * because the user is looking at "This Month" would hide exactly the debt
 * they most need to see. Alerts always run against all open items.
 */
export async function getAlerts(entityId: string, today: Date = new Date()): Promise<AlertsResult> {
  const open = await prisma.financialTransaction.findMany({
    where: { entityId, status: { not: "PAID" } },
    include: { client: true, vendor: true },
    orderBy: { transactionDate: "asc" },
  });

  const withOutstanding = open.map((t) => ({
    ...t,
    outstanding: t.originalAmount.minus(t.paidAmount),
  }));

  const inflow = withOutstanding.filter((t) => t.transactionType === "INFLOW");
  const outflow = withOutstanding.filter((t) => t.transactionType === "OUTFLOW");

  const receivablesAgeing = summariseAgeing(inflow, today);
  const payablesAgeing = summariseAgeing(outflow, today);

  function toOverdueItems(rows: typeof withOutstanding, isInflow: boolean): OverdueItem[] {
    return rows
      .map((t) => {
        const severity = alertSeverity(t.status, t.transactionDate, today);
        if (!severity || t.outstanding.lte(0)) return null;
        return {
          transactionId: t.id,
          description: t.description,
          counterparty: (isInflow ? t.client?.name : t.vendor?.name) ?? "—",
          transactionDate: t.transactionDate,
          daysOverdue: daysBetween(t.transactionDate, today),
          outstanding: t.outstanding,
          status: t.status,
          severity,
        } satisfies OverdueItem;
      })
      .filter((x): x is OverdueItem => x !== null)
      // Largest exposure first — that's the one worth chasing, not merely
      // the oldest.
      .sort((a, b) => b.outstanding.comparedTo(a.outstanding))
      .slice(0, 5);
  }

  return {
    receivablesAgeing,
    receivablesOverdue: totalOverdue(receivablesAgeing),
    payablesAgeing,
    payablesOverdue: totalOverdue(payablesAgeing),
    topOverdueReceivables: toOverdueItems(inflow, true),
    topOverduePayables: toOverdueItems(outflow, false),
  };
}

/** Zero-state used when an entity has no open items at all. */
export function emptyAlerts(): AlertsResult {
  const empty = summariseAgeing([], new Date());
  return {
    receivablesAgeing: empty,
    receivablesOverdue: new Decimal(0),
    payablesAgeing: empty,
    payablesOverdue: new Decimal(0),
    topOverdueReceivables: [],
    topOverduePayables: [],
  };
}
