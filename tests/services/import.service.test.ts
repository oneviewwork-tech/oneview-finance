import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { commitImport, previewImport, rollbackImportBatch } from "@/services/import/import.service";

let entityId: string;
let userId: string;
let categoryId: string;
let expenseTypeId: string;

async function buildWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const pt = wb.addWorksheet("Payment Tracker");
  pt.getRow(8).values = ["#", "Week", "Expense Item", "Category", "Type", "Amount Due (AED)", "Amount Paid (AED)", "Pay Full?"];
  pt.getRow(9).values = [1, "WEEK 1", "_TEST Base Salary", "_TEST IMPORT Salaries", "Current Month", 27840, null, "Y"];
  pt.getRow(10).values = [2, "WEEK 2", "_TEST Office Rent", "_TEST IMPORT Salaries", "Current Month", 15000, 10000, "N"];
  // A row that (once validated) will collide with row 9's signature — same date bucket, description, amount.
  pt.getRow(11).values = [3, "WEEK 1", "_TEST Base Salary", "_TEST IMPORT Salaries", "Current Month", 27840, null, "Y"];
  // Invalid: unknown category.
  pt.getRow(12).values = [4, "WEEK 1", "_TEST Bad Row", "Nonexistent Category", "Current Month", 500, null, "Y"];

  const inflow = wb.addWorksheet("Inflow Tracker");
  inflow.getRow(5).values = ["#", "Date Received", "Client Name", "Service / Project", "Client Type", "Deal Value (AED)", "Amount Received (AED)"];
  inflow.getRow(6).values = [1, new Date(Date.UTC(2026, 7, 5)), "_TEST Gulf Retail LLC", "SMM Retainer", "New Client", 30000, 30000];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTIMPORT", name: "_TEST Import Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  const category = await prisma.financialCategory.create({ data: { name: "_TEST IMPORT Salaries", sortOrder: 990 } });
  categoryId = category.id;
  const expenseType = await prisma.expenseType.findFirstOrThrow({ where: { name: "Current Month" } });
  expenseTypeId = expenseType.id;
});

afterAll(async () => {
  const txns = await prisma.financialTransaction.findMany({ where: { entityId } });
  const ids = txns.map((t) => t.id);
  await prisma.payment.deleteMany({ where: { transactionId: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.financialTransaction.deleteMany({ where: { id: { in: ids } } });

  const clients = await prisma.client.findMany({ where: { entityId } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: clients.map((c) => c.id) } } });
  await prisma.client.deleteMany({ where: { entityId } });

  await prisma.businessEntity.delete({ where: { id: entityId } });
  await prisma.financialCategory.delete({ where: { id: categoryId } });
});

describe("previewImport", () => {
  it("validates rows, flags an intra-batch duplicate, and reports the unknown-category error", async () => {
    const buffer = await buildWorkbook();
    const preview = await previewImport(buffer, entityId, 2026, 8);

    expect(preview.outflow.validRows).toHaveLength(3); // rows 9, 10, 11 (12 is invalid)
    expect(preview.outflow.errors.some((e) => e.message.includes("Unknown category"))).toBe(true);
    // Row 11 duplicates row 9's signature within the same file.
    expect(preview.outflow.duplicateRowNumbers).toContain(11);
    expect(preview.outflow.duplicateRowNumbers).not.toContain(9);

    expect(preview.inflow.validRows).toHaveLength(1);
    expect(preview.inflow.validRows[0].clientName).toBe("_TEST Gulf Retail LLC");
  });
});

describe("commitImport + rollbackImportBatch", () => {
  it("writes real transactions with IMPORT audit events, then rolls the whole batch back", async () => {
    const buffer = await buildWorkbook();
    const preview = await previewImport(buffer, entityId, 2026, 8);

    // Simulate the UI excluding the flagged intra-batch duplicate (row 11) before commit.
    const outflowToCommit = preview.outflow.validRows.filter((r) => !preview.outflow.duplicateRowNumbers.includes(r.rowNumber));
    expect(outflowToCommit).toHaveLength(2);

    const result = await commitImport({
      entityId,
      originalCurrency: "AED",
      outflowRows: outflowToCommit,
      inflowRows: preview.inflow.validRows,
      sourceFileName: "_TEST_workbook.xlsx",
      actorId: userId,
      actorEmail: "test@example.com",
    });

    expect(result.outflowImported).toBe(2);
    expect(result.inflowImported).toBe(1);

    const createdTxns = await prisma.financialTransaction.findMany({ where: { entityId } });
    expect(createdTxns).toHaveLength(3);
    const salary = createdTxns.find((t) => t.description === "_TEST Base Salary")!;
    expect(salary.status).toBe("PAID");
    expect(salary.paidAmount.toString()).toBe("27840");

    const importEvents = await prisma.auditEvent.findMany({ where: { action: "IMPORT", entityId: { in: createdTxns.map((t) => t.id) } } });
    expect(importEvents).toHaveLength(3);
    expect((importEvents[0].metadata as { batchId?: string }).batchId).toBe(result.batchId);

    // Re-preview the SAME file — the just-committed rows should now be flagged as duplicates against the DB.
    const secondPreview = await previewImport(buffer, entityId, 2026, 8);
    expect(secondPreview.outflow.duplicateRowNumbers.length).toBeGreaterThanOrEqual(2);
    expect(secondPreview.inflow.duplicateRowNumbers).toContain(6);

    // Roll back the whole batch.
    const rollback = await rollbackImportBatch(result.batchId, userId, "test@example.com");
    expect(rollback.deletedCount).toBe(3);

    const remaining = await prisma.financialTransaction.findMany({ where: { entityId } });
    expect(remaining).toHaveLength(0);

    const deleteEvents = await prisma.auditEvent.findMany({ where: { action: "DELETE", entityType: "FinancialTransaction" } });
    expect(deleteEvents.some((e) => (e.metadata as { batchId?: string } | null)?.batchId === result.batchId)).toBe(true);
  });
});
