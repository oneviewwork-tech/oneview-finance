import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { validateOutflowRow } from "@/domain/import/validate-outflow";
import { validateInflowRow } from "@/domain/import/validate-inflow";
import type { ImportContext, ImportRowError, LookupMaps, ValidatedInflowRow, ValidatedOutflowRow } from "@/domain/import/types";
import { ZohoFinanceWorkbookProvider } from "./zoho-workbook-provider";
import type { FinancialImportProvider } from "./provider";

const defaultProvider: FinancialImportProvider = new ZohoFinanceWorkbookProvider();

export async function buildLookupMaps(): Promise<LookupMaps> {
  const [categories, expenseTypes, paymentMethods, clientTypes] = await Promise.all([
    prisma.financialCategory.findMany({ where: { isActive: true } }),
    prisma.expenseType.findMany({ where: { isActive: true } }),
    prisma.paymentMethod.findMany({ where: { isActive: true } }),
    prisma.clientType.findMany({ where: { isActive: true } }),
  ]);
  return {
    categories: new Map(categories.map((c) => [c.name.toLowerCase(), c.id])),
    expenseTypes: new Map(expenseTypes.map((t) => [t.name.toLowerCase(), t.id])),
    paymentMethods: new Map(paymentMethods.map((m) => [m.name.toLowerCase(), m.id])),
    clientTypes: new Map(clientTypes.map((t) => [t.name.toLowerCase(), t.id])),
  };
}

export interface ImportSideResult<T> {
  validRows: T[];
  duplicateRowNumbers: number[];
  errors: ImportRowError[];
  skippedCount: number;
}

export interface ImportPreview {
  entityId: string;
  outflow: ImportSideResult<ValidatedOutflowRow>;
  inflow: ImportSideResult<ValidatedInflowRow>;
}

function outflowSignature(entityId: string, r: { transactionDate: Date; description: string; amountDue: Prisma.Decimal }) {
  return `${entityId}|${r.transactionDate.toISOString().slice(0, 10)}|${r.description.trim().toLowerCase()}|${r.amountDue.toString()}`;
}

function inflowSignature(entityId: string, r: { transactionDate: Date; clientName: string; dealValue: Prisma.Decimal }) {
  return `${entityId}|${r.transactionDate.toISOString().slice(0, 10)}|${r.clientName.trim().toLowerCase()}|${r.dealValue.toString()}`;
}

/**
 * Parses + validates an uploaded workbook against an entity's existing
 * data, WITHOUT writing anything — the spec's "Preview" step. Duplicate
 * detection covers both "already in the database" and "appears twice in
 * this same file."
 */
export async function previewImport(
  buffer: Buffer,
  entityId: string,
  periodYear: number,
  periodMonth: number,
  provider: FinancialImportProvider = defaultProvider
): Promise<ImportPreview> {
  const [parsed, lookups] = await Promise.all([provider.parse(buffer), buildLookupMaps()]);
  const context: ImportContext = { periodYear, periodMonth, lookups };

  const outflowValid: ValidatedOutflowRow[] = [];
  const outflowErrors: ImportRowError[] = [];
  let outflowSkipped = 0;
  for (const raw of parsed.outflowRows) {
    const result = validateOutflowRow(raw, context);
    if (result.kind === "valid") outflowValid.push(result.row);
    else if (result.kind === "invalid") outflowErrors.push(...result.errors);
    else outflowSkipped++;
  }

  const inflowValid: ValidatedInflowRow[] = [];
  const inflowErrors: ImportRowError[] = [];
  let inflowSkipped = 0;
  for (const raw of parsed.inflowRows) {
    const result = validateInflowRow(raw, context);
    if (result.kind === "valid") inflowValid.push(result.row);
    else if (result.kind === "invalid") inflowErrors.push(...result.errors);
    else inflowSkipped++;
  }

  // Duplicate detection: existing DB rows for this entity within the
  // imported date span, plus repeats within the file itself.
  const outflowDates = outflowValid.map((r) => r.transactionDate);
  const inflowDates = inflowValid.map((r) => r.transactionDate);
  const [existingOutflow, existingInflow] = await Promise.all([
    outflowDates.length
      ? prisma.financialTransaction.findMany({
          where: {
            entityId,
            transactionType: "OUTFLOW",
            transactionDate: { gte: new Date(Math.min(...outflowDates.map((d) => d.getTime()))), lte: new Date(Math.max(...outflowDates.map((d) => d.getTime()))) },
          },
          select: { transactionDate: true, description: true, originalAmount: true },
        })
      : Promise.resolve([]),
    inflowDates.length
      ? prisma.financialTransaction.findMany({
          where: {
            entityId,
            transactionType: "INFLOW",
            transactionDate: { gte: new Date(Math.min(...inflowDates.map((d) => d.getTime()))), lte: new Date(Math.max(...inflowDates.map((d) => d.getTime()))) },
          },
          select: { transactionDate: true, originalAmount: true, client: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const existingOutflowSignatures = new Set(
    existingOutflow.map((t) => outflowSignature(entityId, { transactionDate: t.transactionDate, description: t.description, amountDue: t.originalAmount }))
  );
  const existingInflowSignatures = new Set(
    existingInflow
      .filter((t) => t.client)
      .map((t) => inflowSignature(entityId, { transactionDate: t.transactionDate, clientName: t.client!.name, dealValue: t.originalAmount }))
  );

  const seenOutflowInBatch = new Set<string>();
  const outflowDuplicates: number[] = [];
  for (const row of outflowValid) {
    const sig = outflowSignature(entityId, row);
    if (existingOutflowSignatures.has(sig) || seenOutflowInBatch.has(sig)) outflowDuplicates.push(row.rowNumber);
    seenOutflowInBatch.add(sig);
  }

  const seenInflowInBatch = new Set<string>();
  const inflowDuplicates: number[] = [];
  for (const row of inflowValid) {
    const sig = inflowSignature(entityId, row);
    if (existingInflowSignatures.has(sig) || seenInflowInBatch.has(sig)) inflowDuplicates.push(row.rowNumber);
    seenInflowInBatch.add(sig);
  }

  return {
    entityId,
    outflow: { validRows: outflowValid, duplicateRowNumbers: outflowDuplicates, errors: outflowErrors, skippedCount: outflowSkipped },
    inflow: { validRows: inflowValid, duplicateRowNumbers: inflowDuplicates, errors: inflowErrors, skippedCount: inflowSkipped },
  };
}

export interface CommitImportInput {
  entityId: string;
  originalCurrency: "AED" | "INR";
  outflowRows: ValidatedOutflowRow[];
  inflowRows: ValidatedInflowRow[];
  sourceFileName: string;
  actorId: string;
  actorEmail: string;
}

export interface CommitImportResult {
  batchId: string;
  outflowImported: number;
  inflowImported: number;
}

/** Inserts every row atomically (all-or-nothing) and tags each with a batchId so the whole import can be rolled back later by that id. */
export async function commitImport(input: CommitImportInput): Promise<CommitImportResult> {
  const batchId = randomUUID();
  const { Decimal } = Prisma;

  await prisma.$transaction(async (tx) => {
    for (const row of input.outflowRows) {
      const txn = await tx.financialTransaction.create({
        data: {
          entityId: input.entityId,
          transactionType: "OUTFLOW",
          transactionDate: row.transactionDate,
          originalAmount: row.amountDue,
          originalCurrency: input.originalCurrency,
          categoryId: row.categoryId,
          expenseTypeId: row.expenseTypeId,
          description: row.description,
          referenceNumber: row.referenceNumber,
          remarks: row.remarks,
          paidAmount: row.amountPaid,
          status: row.status,
          createdById: input.actorId,
        },
      });
      if (row.amountPaid.gt(0)) {
        await tx.payment.create({
          data: {
            transactionId: txn.id,
            amount: row.amountPaid,
            currency: input.originalCurrency,
            paymentDate: row.paymentDate ?? row.transactionDate,
            paymentMethodId: row.paymentMethodId,
            referenceNumber: row.referenceNumber,
            createdById: input.actorId,
          },
        });
      }
      await writeAuditEvent(tx, {
        entityType: "FinancialTransaction",
        entityId: txn.id,
        action: "IMPORT",
        actorUserId: input.actorId,
        actorEmail: input.actorEmail,
        after: { ...txn, originalAmount: txn.originalAmount.toString() },
        metadata: { batchId, sourceFileName: input.sourceFileName, sourceRow: row.rowNumber, sheet: "Payment Tracker" },
      });
    }

    for (const row of input.inflowRows) {
      let clientId: string | null = null;
      const existingClient = await tx.client.findUnique({ where: { entityId_name: { entityId: input.entityId, name: row.clientName } } });
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const client = await tx.client.create({
          data: { entityId: input.entityId, name: row.clientName, clientTypeId: row.clientTypeId },
        });
        clientId = client.id;
      }

      const txn = await tx.financialTransaction.create({
        data: {
          entityId: input.entityId,
          transactionType: "INFLOW",
          transactionDate: row.transactionDate,
          originalAmount: row.dealValue,
          originalCurrency: input.originalCurrency,
          clientId,
          description: row.description,
          closedByName: row.closedByName,
          referenceNumber: row.referenceNumber,
          remarks: row.remarks,
          paidAmount: row.amountReceived,
          status: row.status,
          createdById: input.actorId,
        },
      });
      if (row.amountReceived.gt(0)) {
        await tx.payment.create({
          data: {
            transactionId: txn.id,
            amount: row.amountReceived,
            currency: input.originalCurrency,
            paymentDate: row.transactionDate,
            paymentMethodId: row.paymentMethodId,
            referenceNumber: row.referenceNumber,
            createdById: input.actorId,
          },
        });
      }
      await writeAuditEvent(tx, {
        entityType: "FinancialTransaction",
        entityId: txn.id,
        action: "IMPORT",
        actorUserId: input.actorId,
        actorEmail: input.actorEmail,
        after: { ...txn, originalAmount: txn.originalAmount.toString() },
        metadata: { batchId, sourceFileName: input.sourceFileName, sourceRow: row.rowNumber, sheet: "Inflow Tracker" },
      });
    }
  });

  return { batchId, outflowImported: input.outflowRows.length, inflowImported: input.inflowRows.length };
}

async function findImportBatchTransactionIds(batchId: string): Promise<string[]> {
  const importEvents = await prisma.auditEvent.findMany({
    where: { action: "IMPORT", entityType: "FinancialTransaction" },
  });
  return importEvents
    .filter((e) => (e.metadata as { batchId?: string } | null)?.batchId === batchId)
    .map((e) => e.entityId);
}

/** Resolves which business entity(ies) an import batch touched, so callers can enforce entity-scoped write access before rolling back. */
export async function getImportBatchEntityCodes(batchId: string): Promise<string[]> {
  const transactionIds = await findImportBatchTransactionIds(batchId);
  if (transactionIds.length === 0) return [];
  const transactions = await prisma.financialTransaction.findMany({
    where: { id: { in: transactionIds } },
    select: { entity: { select: { code: true } } },
  });
  return [...new Set(transactions.map((t) => t.entity.code))];
}

/** Undoes an entire import batch — Payments cascade-delete with their transaction. "Rollback where practical," per the spec. */
export async function rollbackImportBatch(batchId: string, actorId: string, actorEmail: string): Promise<{ deletedCount: number }> {
  const transactionIds = await findImportBatchTransactionIds(batchId);

  if (transactionIds.length === 0) return { deletedCount: 0 };

  await prisma.$transaction(async (tx) => {
    for (const id of transactionIds) {
      await writeAuditEvent(tx, {
        entityType: "FinancialTransaction",
        entityId: id,
        action: "DELETE",
        actorUserId: actorId,
        actorEmail,
        metadata: { reason: "import rollback", batchId },
      });
    }
    await tx.financialTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  });

  return { deletedCount: transactionIds.length };
}
