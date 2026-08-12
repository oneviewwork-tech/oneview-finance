import { Prisma } from "@prisma/client";
import type { TransactionStatus } from "@prisma/client";

// Raw cell values straight off the sheet — exactly what a Zoho Finance
// Tracker export contains, before any lookup/validation. Kept close to the
// spreadsheet shape so a parser (the ZohoFinanceWorkbookProvider) has
// nothing to decide except "which column is which."

// Excel cells commonly come back from exceljs already coerced to a JS Date
// for date-formatted cells, or as a plain string/number otherwise — raw
// rows have to accept either and let validation sort it out.
export type RawCellValue = string | number | Date | null;

export interface RawOutflowRow {
  rowNumber: number;
  week: RawCellValue;
  expenseItem: RawCellValue;
  category: RawCellValue;
  type: RawCellValue;
  amountDue: RawCellValue;
  amountPaid: RawCellValue;
  payFull: RawCellValue;
  datePaid: RawCellValue;
  mode: RawCellValue;
  referenceNo: RawCellValue;
  remarks: RawCellValue;
}

export interface RawInflowRow {
  rowNumber: number;
  dateReceived: RawCellValue;
  clientName: RawCellValue;
  serviceProject: RawCellValue;
  clientType: RawCellValue;
  dealValue: RawCellValue;
  amountReceived: RawCellValue;
  paymentMode: RawCellValue;
  referenceNo: RawCellValue;
  closedBy: RawCellValue;
  remarks: RawCellValue;
}

// ── Validated rows — ready to insert, every reference already resolved to a real id ──

export interface ValidatedOutflowRow {
  rowNumber: number;
  transactionDate: Date;
  description: string;
  categoryId: string;
  categoryName: string;
  expenseTypeId: string;
  expenseTypeName: string;
  amountDue: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  status: TransactionStatus;
  paymentDate: Date | null;
  paymentMethodId: string | null;
  referenceNumber: string | null;
  remarks: string | null;
}

export interface ValidatedInflowRow {
  rowNumber: number;
  transactionDate: Date;
  description: string;
  clientName: string;
  clientTypeId: string | null;
  clientTypeName: string | null;
  dealValue: Prisma.Decimal;
  amountReceived: Prisma.Decimal;
  status: TransactionStatus;
  paymentMethodId: string | null;
  referenceNumber: string | null;
  closedByName: string | null;
  remarks: string | null;
}

export interface ImportRowError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface LookupMaps {
  categories: Map<string, string>; // lowercased name -> id
  expenseTypes: Map<string, string>;
  paymentMethods: Map<string, string>;
  clientTypes: Map<string, string>;
}

export interface ImportContext {
  periodYear: number;
  periodMonth: number; // 1-12
  lookups: LookupMaps;
}
