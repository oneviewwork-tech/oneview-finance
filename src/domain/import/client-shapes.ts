import { Prisma } from "@prisma/client";
import type { Currency, TransactionStatus } from "@prisma/client";
import type { ValidatedInflowRow, ValidatedOutflowRow } from "./types";

const { Decimal } = Prisma;

// Server Actions serialize return values across the RSC boundary; a
// Prisma.Decimal instance doesn't survive that trip the way a Date does,
// so every amount here is a plain decimal string instead. These are the
// "client-safe" mirrors of the domain's Validated*Row types.

export interface ClientOutflowRow {
  rowNumber: number;
  transactionDate: string; // ISO date
  description: string;
  categoryId: string;
  categoryName: string;
  expenseTypeId: string;
  expenseTypeName: string;
  amountDue: string;
  amountPaid: string;
  status: TransactionStatus;
  paymentDate: string | null;
  paymentMethodId: string | null;
  referenceNumber: string | null;
  remarks: string | null;
}

export interface ClientInflowRow {
  rowNumber: number;
  transactionDate: string;
  description: string;
  clientName: string;
  clientTypeId: string | null;
  clientTypeName: string | null;
  dealValue: string;
  amountReceived: string;
  status: TransactionStatus;
  paymentMethodId: string | null;
  referenceNumber: string | null;
  closedByName: string | null;
  remarks: string | null;
}

export function toClientOutflowRow(row: ValidatedOutflowRow): ClientOutflowRow {
  return {
    rowNumber: row.rowNumber,
    transactionDate: row.transactionDate.toISOString(),
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    expenseTypeId: row.expenseTypeId,
    expenseTypeName: row.expenseTypeName,
    amountDue: row.amountDue.toString(),
    amountPaid: row.amountPaid.toString(),
    status: row.status,
    paymentDate: row.paymentDate ? row.paymentDate.toISOString() : null,
    paymentMethodId: row.paymentMethodId,
    referenceNumber: row.referenceNumber,
    remarks: row.remarks,
  };
}

export function toClientInflowRow(row: ValidatedInflowRow): ClientInflowRow {
  return {
    rowNumber: row.rowNumber,
    transactionDate: row.transactionDate.toISOString(),
    description: row.description,
    clientName: row.clientName,
    clientTypeId: row.clientTypeId,
    clientTypeName: row.clientTypeName,
    dealValue: row.dealValue.toString(),
    amountReceived: row.amountReceived.toString(),
    status: row.status,
    paymentMethodId: row.paymentMethodId,
    referenceNumber: row.referenceNumber,
    closedByName: row.closedByName,
    remarks: row.remarks,
  };
}

export function fromClientOutflowRow(row: ClientOutflowRow): ValidatedOutflowRow {
  return {
    rowNumber: row.rowNumber,
    transactionDate: new Date(row.transactionDate),
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    expenseTypeId: row.expenseTypeId,
    expenseTypeName: row.expenseTypeName,
    amountDue: new Decimal(row.amountDue),
    amountPaid: new Decimal(row.amountPaid),
    status: row.status,
    paymentDate: row.paymentDate ? new Date(row.paymentDate) : null,
    paymentMethodId: row.paymentMethodId,
    referenceNumber: row.referenceNumber,
    remarks: row.remarks,
  };
}

export function fromClientInflowRow(row: ClientInflowRow): ValidatedInflowRow {
  return {
    rowNumber: row.rowNumber,
    transactionDate: new Date(row.transactionDate),
    description: row.description,
    clientName: row.clientName,
    clientTypeId: row.clientTypeId,
    clientTypeName: row.clientTypeName,
    dealValue: new Decimal(row.dealValue),
    amountReceived: new Decimal(row.amountReceived),
    status: row.status,
    paymentMethodId: row.paymentMethodId,
    referenceNumber: row.referenceNumber,
    closedByName: row.closedByName,
    remarks: row.remarks,
  };
}

export interface ClientImportPreview {
  entityId: string;
  outflow: {
    validRows: ClientOutflowRow[];
    duplicateRowNumbers: number[];
    errors: { rowNumber: number; field?: string; message: string }[];
    skippedCount: number;
  };
  inflow: {
    validRows: ClientInflowRow[];
    duplicateRowNumbers: number[];
    errors: { rowNumber: number; field?: string; message: string }[];
    skippedCount: number;
  };
}

export type { Currency };
