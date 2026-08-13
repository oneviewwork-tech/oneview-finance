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

/**
 * Category and department filters, so a drill-down from a calculated card
 * lands on the rows that actually made up its number.
 *
 * Added because "Records" on the Salary card linked to every paid expense —
 * the link carried a status but no category, so it answered "what did we
 * pay" rather than "what did we pay in salary". A filter that silently
 * widens is worse than no link at all: the total on screen no longer
 * matches the total you clicked.
 */
export interface RecordFilters {
  status: StatusFilter | null;
  /** Matched against FinancialCategory.name — categories are user-editable
   *  master data with no stable code to key on. */
  categoryNames: string[] | null;
  departmentId: string | null;
  /** Rows explicitly carrying no department, for an "Unassigned" drill-down. */
  untaggedDepartment: boolean;
}

export function parseRecordFilters(params: {
  status?: string;
  category?: string;
  department?: string;
}): RecordFilters {
  const category = params.category?.trim();
  const department = params.department?.trim();
  return {
    status: parseStatusFilter(params.status),
    // Comma-separated so a card covering several categories can drill in
    // without needing a second parameter shape.
    categoryNames: category ? category.split(",").map((c) => c.trim()).filter(Boolean) : null,
    departmentId: department && department !== "none" ? department : null,
    untaggedDepartment: department === "none",
  };
}

export function hasAnyFilter(f: RecordFilters): boolean {
  return !!f.status || !!f.categoryNames || !!f.departmentId || f.untaggedDepartment;
}

export function describeRecordFilters(f: RecordFilters, departmentName?: string): string[] {
  const parts: string[] = [];
  if (f.status) parts.push(describeStatusFilter(f.status));
  if (f.categoryNames) parts.push(f.categoryNames.join(", "));
  if (f.untaggedDepartment) parts.push("No department");
  else if (f.departmentId) parts.push(departmentName ?? "Department");
  return parts;
}
