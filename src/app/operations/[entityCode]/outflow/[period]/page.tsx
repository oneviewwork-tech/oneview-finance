import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { formatDate, formatMoney } from "@/lib/format";
import { parsePeriodKey, periodRange, weekLabel } from "@/domain/finance/period";
import { getMonthTotals } from "@/services/finance/ledger-months";
import { MonthSheet, type SheetColumn } from "@/components/finance/month-sheet";

// Mirrors the Payment Tracker's column order so someone moving off the
// workbook finds the same fields in the same places.
const COLUMNS: SheetColumn[] = [
  { key: "week", label: "Week" },
  { key: "item", label: "Expense Item" },
  { key: "category", label: "Category" },
  { key: "type", label: "Type" },
  { key: "due", label: "Amount Due", align: "right", entry: true },
  { key: "paid", label: "Amount Paid", align: "right", entry: true },
  { key: "balance", label: "Balance", align: "right" },
  { key: "datePaid", label: "Date Paid" },
  { key: "reference", label: "Reference No." },
];

export default async function OutflowMonthPage({
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
        transactionType: "OUTFLOW",
        transactionDate: { gte: range.from, lte: range.to },
      },
      include: { category: true, expenseType: true, payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
    getMonthTotals(entity.id, "OUTFLOW", period),
  ]);

  const rows = transactions.map((t) => ({
    id: t.id,
    status: t.status,
    cells: {
      week: weekLabel(t.transactionDate),
      item: t.description,
      category: t.category?.name ?? "-",
      type: t.expenseType?.name ?? "-",
      due: formatMoney(t.originalAmount, t.originalCurrency),
      paid: formatMoney(t.paidAmount, t.originalCurrency),
      balance: formatMoney(t.originalAmount.minus(t.paidAmount), t.originalCurrency),
      datePaid: t.payments[0] ? formatDate(t.payments[0].paymentDate) : "-",
      reference: t.referenceNumber ?? "-",
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
      backHref={`/operations/${entityCode}/outflow`}
      addHref={`/operations/${entityCode}/outflow/new`}
      canWrite={canWrite}
      labels={{ title: "Payment Tracker", total: "Total Due", settled: "Paid", outstanding: "Pending" }}
    />
  );
}
