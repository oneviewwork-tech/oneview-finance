import type { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import { toCsv } from "@/domain/export/csv";
import { weekLabel } from "@/domain/finance/period";

/**
 * Transaction export.
 *
 * Amounts are emitted as plain decimal strings (`27840.00`), not the
 * formatted `₹27,840.00` the UI shows: this file is opened in Excel and
 * pivoted, so the numbers have to stay numeric. The currency is carried in
 * its own column instead, which also keeps AED and INR rows unambiguous.
 */

const INFLOW_HEADERS = [
  "Date",
  "Client",
  "Client Type",
  "Service / Project",
  "Deal Value",
  "Amount Received",
  "Balance Due",
  "Currency",
  "Status",
  "Closed By",
  "Reference No.",
  "Remarks",
] as const;

const OUTFLOW_HEADERS = [
  "Date",
  "Week",
  "Expense Item",
  "Category",
  "Type",
  "Department",
  "Vendor",
  "Amount Due",
  "Amount Paid",
  "Balance",
  "Currency",
  "Status",
  "Reference No.",
  "Remarks",
] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function exportTransactionsCsv(
  entityId: string,
  transactionType: TransactionType,
  range?: DateRange
): Promise<string> {
  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId,
      transactionType,
      ...(range ? { transactionDate: { gte: range.from, lte: range.to } } : {}),
    },
    include: {
      client: { include: { clientType: true } },
      vendor: true,
      category: true,
      expenseType: true,
      department: true,
    },
    orderBy: { transactionDate: "asc" },
  });

  if (transactionType === "INFLOW") {
    const rows = transactions.map((t) => [
      isoDate(t.transactionDate),
      t.client?.name ?? "",
      t.client?.clientType?.name ?? "",
      t.description,
      t.originalAmount.toFixed(2),
      t.paidAmount.toFixed(2),
      t.originalAmount.minus(t.paidAmount).toFixed(2),
      t.originalCurrency,
      t.status,
      t.closedByName ?? "",
      t.referenceNumber ?? "",
      t.remarks ?? "",
    ]);
    return toCsv(INFLOW_HEADERS, rows);
  }

  const rows = transactions.map((t) => [
    isoDate(t.transactionDate),
    weekLabel(t.transactionDate),
    t.description,
    t.category?.name ?? "",
    t.expenseType?.name ?? "",
    t.department?.name ?? "",
    t.vendor?.name ?? "",
    t.originalAmount.toFixed(2),
    t.paidAmount.toFixed(2),
    t.originalAmount.minus(t.paidAmount).toFixed(2),
    t.originalCurrency,
    t.status,
    t.referenceNumber ?? "",
    t.remarks ?? "",
  ]);
  return toCsv(OUTFLOW_HEADERS, rows);
}
