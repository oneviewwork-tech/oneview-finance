import type { Prisma, TransactionStatus } from "@prisma/client";

/**
 * Status filter for the inflow/outflow lists, driven by the URL so a
 * dashboard tile can deep-link into "the records behind this number".
 *
 * "unpaid" exists as its own value rather than making callers pass two
 * statuses: the figures people drill into — Liabilities, Receivables — mean
 * "anything not fully settled", which is PARTIAL *and* PENDING. Leaving that
 * to the caller invites one of the two being forgotten, which silently
 * understates money owed.
 */
export type StatusFilter = TransactionStatus | "unpaid";

const EXACT: TransactionStatus[] = ["PAID", "PARTIAL", "PENDING"];

export function parseStatusFilter(value: string | undefined | null): StatusFilter | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (EXACT.includes(upper as TransactionStatus)) return upper as TransactionStatus;
  if (value.toLowerCase() === "unpaid") return "unpaid";
  return null;
}

/** Prisma `status` clause for a filter, or undefined for "no filter". */
export function statusWhereClause(
  filter: StatusFilter | null
): Prisma.EnumTransactionStatusFilter | TransactionStatus | undefined {
  if (!filter) return undefined;
  if (filter === "unpaid") return { not: "PAID" };
  return filter;
}

export function describeStatusFilter(filter: StatusFilter): string {
  switch (filter) {
    case "unpaid":
      return "Not fully settled";
    case "PAID":
      return "Paid";
    case "PARTIAL":
      return "Partially paid";
    case "PENDING":
      return "Pending";
  }
}
