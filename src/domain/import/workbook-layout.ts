/**
 * The physical layout of the ONEVIEW Finance workbook.
 *
 * Single source of truth, shared by the importer (which reads these
 * positions) and the exporter (which writes them). Keeping one copy is the
 * point: if the exporter wrote its header on row 8 while the importer read
 * from row 9, an exported file would silently fail to re-import, and the
 * mismatch would only surface as "no valid rows found".
 *
 * Confirmed against Dubai_August_2026_Live_Finance_Tracker.xlsx.
 */

export const OUTFLOW_SHEET = "Payment Tracker";
export const OUTFLOW_HEADER_ROW = 8;
export const OUTFLOW_FIRST_ROW = 9;
export const OUTFLOW_LAST_ROW = 148;

export const INFLOW_SHEET = "Inflow Tracker";
export const INFLOW_HEADER_ROW = 5;
export const INFLOW_FIRST_ROW = 6;
export const INFLOW_LAST_ROW = 85;

/** 1-indexed column positions — ExcelJS uses 1-based cell addressing. */
export const OUTFLOW_COL = {
  index: 1,
  week: 2,
  expenseItem: 3,
  category: 4,
  type: 5,
  amountDue: 6,
  amountPaid: 7,
  payFull: 8,
  paid: 9,
  balance: 10,
  status: 11,
  datePaid: 12,
  mode: 13,
  referenceNo: 14,
  remarks: 15,
} as const;

export const INFLOW_COL = {
  index: 1,
  dateReceived: 2,
  clientName: 3,
  serviceProject: 4,
  clientType: 5,
  dealValue: 6,
  amountReceived: 7,
  balanceDue: 8,
  percentCollected: 9,
  paymentMode: 10,
  referenceNo: 11,
  closedBy: 12,
  month: 13,
  remarks: 14,
} as const;

/** Header text, positioned by the column maps above. Currency is interpolated. */
export function outflowHeaders(currency: string): string[] {
  return [
    "#",
    "Week",
    "Expense Item",
    "Category",
    "Type",
    `Amount Due (${currency})`,
    `Amount Paid (${currency})`,
    "Pay Full?",
    `Paid (${currency})`,
    `Balance (${currency})`,
    "Status",
    "Date Paid",
    "Mode",
    "Reference No.",
    "Remarks",
  ];
}

export function inflowHeaders(currency: string): string[] {
  return [
    "#",
    "Date Received",
    "Client Name",
    "Service / Project",
    "Client Type",
    `Deal Value (${currency})`,
    `Amount Received (${currency})`,
    `Balance Due (${currency})`,
    "% Collected",
    "Payment Mode",
    "Reference No.",
    "Closed By (BD)",
    "Month",
    "Remarks",
  ];
}
