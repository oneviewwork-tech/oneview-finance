import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { exportWorkbook } from "@/services/export/workbook-export.service";
import { previewImport } from "@/services/import/import.service";
import {
  OUTFLOW_SHEET,
  INFLOW_SHEET,
  OUTFLOW_HEADER_ROW,
  OUTFLOW_FIRST_ROW,
  OUTFLOW_COL,
  INFLOW_FIRST_ROW,
  INFLOW_COL,
} from "@/domain/import/workbook-layout";

/**
 * The point of matching the source workbook's layout is that an exported file
 * can be edited and fed straight back through Import. That round trip is the
 * real contract, so it's asserted directly rather than inferred from the
 * export looking plausible.
 */

let entityId: string;
let userId: string;
let categoryId: string;
let expenseTypeId: string;

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  const leftover = await prisma.businessEntity.findUnique({ where: { code: "_TESTEXPORT" } });
  if (leftover) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftover.id } });
    await prisma.client.deleteMany({ where: { entityId: leftover.id } });
    await prisma.businessEntity.delete({ where: { id: leftover.id } });
  }
  const leftoverCat = await prisma.financialCategory.findFirst({ where: { name: "_TEST EXPORT Salaries" } });
  if (leftoverCat) await prisma.financialCategory.delete({ where: { id: leftoverCat.id } });

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTEXPORT", name: "_TEST Export Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  const category = await prisma.financialCategory.create({ data: { name: "_TEST EXPORT Salaries", sortOrder: 998 } });
  categoryId = category.id;
  const expenseType = await prisma.expenseType.findFirstOrThrow({ where: { name: "Current Month" } });
  expenseTypeId = expenseType.id;
  const clientType = await prisma.clientType.findFirstOrThrow({ where: { name: "New Client" } });

  const client = await prisma.client.create({
    data: { entityId, name: "_TEST EXPORT Client", clientTypeId: clientType.id },
  });

  const base = { entityId, originalCurrency: "AED" as const, createdById: userId };
  await prisma.financialTransaction.createMany({
    data: [
      {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: new Date(Date.UTC(2026, 7, 3)),
        originalAmount: "27840",
        paidAmount: "27840",
        status: "PAID",
        categoryId,
        expenseTypeId,
        description: "_TEST EXPORT Base Salary",
      },
      {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: new Date(Date.UTC(2026, 7, 12)),
        originalAmount: "15000",
        paidAmount: "10000",
        status: "PARTIAL",
        categoryId,
        expenseTypeId,
        description: "_TEST EXPORT Office Rent",
      },
      {
        ...base,
        transactionType: "INFLOW",
        transactionDate: new Date(Date.UTC(2026, 7, 5)),
        originalAmount: "30000",
        paidAmount: "30000",
        status: "PAID",
        clientId: client.id,
        description: "_TEST EXPORT SMM Retainer",
      },
    ],
  });
});

afterAll(async () => {
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.client.deleteMany({ where: { entityId } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
  if (categoryId) await prisma.financialCategory.delete({ where: { id: categoryId } });
});

describe("exportWorkbook", () => {
  it("writes the sheets and header positions the importer expects", async () => {
    const buffer = await exportWorkbook(entityId);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

    const pt = wb.getWorksheet(OUTFLOW_SHEET);
    const it = wb.getWorksheet(INFLOW_SHEET);
    expect(pt).toBeDefined();
    expect(it).toBeDefined();

    // Header text lands on the row the importer reads past.
    expect(pt!.getRow(OUTFLOW_HEADER_ROW).getCell(OUTFLOW_COL.expenseItem).value).toBe("Expense Item");
    expect(pt!.getRow(OUTFLOW_HEADER_ROW).getCell(OUTFLOW_COL.category).value).toBe("Category");

    // Data starts exactly where the importer starts reading.
    expect(pt!.getRow(OUTFLOW_FIRST_ROW).getCell(OUTFLOW_COL.expenseItem).value).toBe("_TEST EXPORT Base Salary");
    expect(it!.getRow(INFLOW_FIRST_ROW).getCell(INFLOW_COL.clientName).value).toBe("_TEST EXPORT Client");
  });

  it("writes computed columns as live formulas, not baked values", async () => {
    const buffer = await exportWorkbook(entityId);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const pt = wb.getWorksheet(OUTFLOW_SHEET)!;

    const balance = pt.getRow(OUTFLOW_FIRST_ROW).getCell(OUTFLOW_COL.balance).value as { formula?: string };
    const status = pt.getRow(OUTFLOW_FIRST_ROW).getCell(OUTFLOW_COL.status).value as { formula?: string };
    expect(balance.formula).toContain("-$I");
    expect(status.formula).toContain("PENDING");
  });

  // The contract that matters: export -> re-import with no edits.
  it("produces a workbook that re-imports cleanly", async () => {
    const buffer = await exportWorkbook(entityId);

    const preview = await previewImport(buffer, entityId, 2026, 8);

    expect(preview.outflow.errors).toHaveLength(0);
    expect(preview.inflow.errors).toHaveLength(0);
    expect(preview.outflow.validRows).toHaveLength(2);
    expect(preview.inflow.validRows).toHaveLength(1);

    const salary = preview.outflow.validRows.find((r) => r.description === "_TEST EXPORT Base Salary")!;
    expect(salary.amountDue.toString()).toBe("27840");
    // Pay Full? = Y round-trips as fully paid.
    expect(salary.amountPaid.toString()).toBe("27840");

    const rent = preview.outflow.validRows.find((r) => r.description === "_TEST EXPORT Office Rent")!;
    expect(rent.amountPaid.toString()).toBe("10000");

    const deal = preview.inflow.validRows[0];
    expect(deal.clientName).toBe("_TEST EXPORT Client");
    expect(deal.dealValue.toString()).toBe("30000");
  });

  /**
   * A property of the workbook format, not a defect: the Payment Tracker
   * carries a WEEK label rather than a per-row expense date, so a date can
   * only survive a round trip at week granularity. Aug 3 is in WEEK 1 and
   * re-imports as Aug 1 (the bucket's first day).
   *
   * Asserted explicitly so the behaviour is a documented decision rather
   * than something a future reader discovers by surprise. The Inflow Tracker
   * does carry a real date, and that survives exactly.
   */
  it("round-trips outflow dates at week granularity and inflow dates exactly", async () => {
    const buffer = await exportWorkbook(entityId);
    const preview = await previewImport(buffer, entityId, 2026, 8);

    const salary = preview.outflow.validRows.find((r) => r.description === "_TEST EXPORT Base Salary")!;
    // Stored as Aug 3 (WEEK 1) -> comes back as Aug 1.
    expect(salary.transactionDate.toISOString().slice(0, 10)).toBe("2026-08-01");

    const rent = preview.outflow.validRows.find((r) => r.description === "_TEST EXPORT Office Rent")!;
    // Stored as Aug 12 (WEEK 2) -> comes back as Aug 8.
    expect(rent.transactionDate.toISOString().slice(0, 10)).toBe("2026-08-08");

    // Inflow keeps its exact date, because the sheet has a real date column.
    expect(preview.inflow.validRows[0].transactionDate.toISOString().slice(0, 10)).toBe("2026-08-05");
  });
});
