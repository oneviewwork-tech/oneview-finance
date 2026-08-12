import { Prisma } from "@prisma/client";
import { calculateStatus, wouldOverpay } from "@/domain/finance/calculations";
import { dateForWeekOfMonth } from "@/domain/finance/period";
import { cellToDate, cellToDecimalString, cellToText } from "./cell-parsing";
import type { ImportContext, ImportRowError, RawOutflowRow, ValidatedOutflowRow } from "./types";

const { Decimal } = Prisma;
const WEEK_PATTERN = /^WEEK\s*([1-4])$/i;

export type OutflowValidationResult =
  | { kind: "valid"; row: ValidatedOutflowRow }
  | { kind: "skipped" } // a genuinely blank template row — not an error
  | { kind: "invalid"; errors: ImportRowError[] };

export function validateOutflowRow(raw: RawOutflowRow, context: ImportContext): OutflowValidationResult {
  const expenseItem = cellToText(raw.expenseItem);
  const amountDueRaw = cellToDecimalString(raw.amountDue);

  if (!expenseItem && !amountDueRaw) {
    return { kind: "skipped" };
  }

  const errors: ImportRowError[] = [];

  if (!expenseItem) {
    errors.push({ rowNumber: raw.rowNumber, field: "expenseItem", message: "Expense Item is required" });
  }
  if (!amountDueRaw) {
    errors.push({ rowNumber: raw.rowNumber, field: "amountDue", message: "Amount Due is missing or not a valid number" });
  }

  const weekText = cellToText(raw.week);
  const weekMatch = weekText ? WEEK_PATTERN.exec(weekText) : null;
  if (!weekMatch) {
    errors.push({ rowNumber: raw.rowNumber, field: "week", message: `Week must be one of WEEK 1-4 (got "${weekText ?? ""}")` });
  }

  const categoryText = cellToText(raw.category);
  const categoryId = categoryText ? context.lookups.categories.get(categoryText.toLowerCase()) : undefined;
  if (!categoryText) {
    errors.push({ rowNumber: raw.rowNumber, field: "category", message: "Category is required" });
  } else if (!categoryId) {
    errors.push({
      rowNumber: raw.rowNumber,
      field: "category",
      message: `Unknown category "${categoryText}" — add it in Master Data first or fix the spelling`,
    });
  }

  const typeText = cellToText(raw.type);
  const expenseTypeId = typeText ? context.lookups.expenseTypes.get(typeText.toLowerCase()) : undefined;
  if (!typeText) {
    errors.push({ rowNumber: raw.rowNumber, field: "type", message: "Type is required" });
  } else if (!expenseTypeId) {
    errors.push({
      rowNumber: raw.rowNumber,
      field: "type",
      message: `Unknown type "${typeText}" — add it in Master Data first or fix the spelling`,
    });
  }

  const payFullText = cellToText(raw.payFull);
  const isPayFull = payFullText?.toUpperCase() === "Y";
  const amountPaidRaw = cellToDecimalString(raw.amountPaid);
  if (raw.amountPaid && !isPayFull && amountPaidRaw === null && cellToText(raw.amountPaid)) {
    errors.push({ rowNumber: raw.rowNumber, field: "amountPaid", message: "Amount Paid is not a valid number" });
  }

  const modeText = cellToText(raw.mode);
  const paymentMethodId = modeText ? context.lookups.paymentMethods.get(modeText.toLowerCase()) : undefined;
  if (modeText && !paymentMethodId) {
    errors.push({ rowNumber: raw.rowNumber, field: "mode", message: `Unknown payment mode "${modeText}"` });
  }

  if (errors.length > 0 || !amountDueRaw || !weekMatch || !categoryId || !expenseTypeId) {
    return { kind: "invalid", errors };
  }

  const amountDue = new Decimal(amountDueRaw);
  // Mirrors the workbook's Paid formula exactly: Pay Full "Y" -> full amount, else the typed partial (or 0).
  const amountPaid = isPayFull ? amountDue : amountPaidRaw ? new Decimal(amountPaidRaw) : new Decimal(0);

  if (wouldOverpay(amountDue, new Decimal(0), amountPaid)) {
    return {
      kind: "invalid",
      errors: [{ rowNumber: raw.rowNumber, field: "amountPaid", message: "Amount Paid exceeds Amount Due" }],
    };
  }

  const week = Number(weekMatch[1]) as 1 | 2 | 3 | 4;
  const transactionDate = dateForWeekOfMonth(context.periodYear, context.periodMonth, week);

  return {
    kind: "valid",
    row: {
      rowNumber: raw.rowNumber,
      transactionDate,
      description: expenseItem!,
      categoryId: categoryId!,
      categoryName: categoryText!,
      expenseTypeId: expenseTypeId!,
      expenseTypeName: typeText!,
      amountDue,
      amountPaid,
      status: calculateStatus(amountDue, amountPaid),
      paymentDate: amountPaid.gt(0) ? cellToDate(raw.datePaid) ?? transactionDate : null,
      paymentMethodId: paymentMethodId ?? null,
      referenceNumber: cellToText(raw.referenceNo),
      remarks: cellToText(raw.remarks),
    },
  };
}
