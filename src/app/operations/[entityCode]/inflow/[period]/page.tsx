import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { formatDate, formatMoney } from "@/lib/format";
import { parsePeriodKey, periodRange } from "@/domain/finance/period";
import { calculateCollectedFraction } from "@/domain/finance/calculations";
import { getMonthTotals } from "@/services/finance/ledger-months";
import { MonthSheet, type SheetColumn } from "@/components/finance/month-sheet";

// Mirrors the Inflow Tracker's column order.
const COLUMNS: SheetColumn[] = [
  { key: "date", label: "Date Received" },
  { key: "client", label: "Client Name" },
  { key: "service", label: "Service / Project" },
  { key: "department", label: "Department" },
  { key: "deal", label: "Deal Value", align: "right", entry: true },
  { key: "received", label: "Received", align: "right", entry: true },
  { key: "balance", label: "Balance Due", align: "right" },
  { key: "collected", label: "% Collected", align: "right" },
  { key: "closedBy", label: "Closed By" },
];

export default async function InflowMonthPage({
  params,
}: {
  params: Promise<{ entityCode: string; period: string }>;
}) {
  const { entityCode, period: periodKey } = await params;
  const period = parsePeriodKey(periodKey);
  if (!period) notFound();

  const entity = await requireEntityBySlug(entityCode);
  const user = await requireUser();
  const canWrite = canWriteEntity(user.role, entity.code);

  const range = periodRange(period);
  const [transactions, totals] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: {
        entityId: entity.id,
        transactionType: "INFLOW",
        transactionDate: { gte: range.from, lte: range.to },
      },
      include: { client: true, department: true },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
    getMonthTotals(entity.id, "INFLOW", period),
  ]);

  const rows = transactions.map((t) => ({
    id: t.id,
    status: t.status,
    cells: {
      date: formatDate(t.transactionDate),
      client: t.client?.name ?? "-",
      service: t.description,
      department: t.department?.name ?? "-",
      deal: formatMoney(t.originalAmount, t.originalCurrency),
      received: formatMoney(t.paidAmount, t.originalCurrency),
      balance: formatMoney(t.originalAmount.minus(t.paidAmount), t.originalCurrency),
      collected: `${(calculateCollectedFraction(t.originalAmount, t.paidAmount).toNumber() * 100).toFixed(1)}%`,
      closedBy: t.closedByName ?? "-",
    },
  }));

  return (
    <MonthSheet
      period={period}
      entityName={entity.name}
      currency={entity.baseCurrency}
      columns={COLUMNS}
      rows={rows}
      totals={{
        total: totals.total.toNumber(),
        settled: totals.settled.toNumber(),
        outstanding: totals.outstanding.toNumber(),
        settledFraction: totals.settledFraction.toNumber(),
      }}
      backHref={`/operations/${entityCode}/inflow`}
      addHref={`/operations/${entityCode}/inflow/new`}
      canWrite={canWrite}
      labels={{ title: "Inflow Tracker", total: "Total Deal Value", settled: "Received", outstanding: "Balance Due" }}
    />
  );
}
