import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { commitImport, previewImport } from "@/services/import/import.service";

/**
 * The India workbook is structurally identical to the Dubai one and differs
 * only in currency. This proves that claim against the real importer: the
 * same sheet layout parses, and every written row (transaction AND payment)
 * lands as INR rather than inheriting AED from the Dubai-shaped fixture.
 */

let entityId: string;
let userId: string;
let categoryId: string;

async function buildIndiaWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Same sheet names, same header row positions, same column order as Dubai.
  const pt = wb.addWorksheet("Payment Tracker");
  pt.getRow(8).values = ["#", "Week", "Expense Item", "Category", "Type", "Amount Due (INR)", "Amount Paid (INR)", "Pay Full?"];
  pt.getRow(9).values = [1, "WEEK 1", "_TEST IN Salary", "_TEST IN Salaries", "Current Month", 250000, null, "Y"];
  pt.getRow(10).values = [2, "WEEK 2", "_TEST IN Rent", "_TEST IN Salaries", "Current Month", 80000, 30000, "N"];

  const inflow = wb.addWorksheet("Inflow Tracker");
  inflow.getRow(5).values = ["#", "Date Received", "Client Name", "Service / Project", "Client Type", "Deal Value (INR)", "Amount Received (INR)"];
  inflow.getRow(6).values = [1, new Date(Date.UTC(2026, 7, 5)), "_TEST IN Client", "Retainer", "New Client", 500000, 200000];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  const leftover = await prisma.businessEntity.findUnique({ where: { code: "_TESTINDIA" } });
  if (leftover) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftover.id } });
    await prisma.client.deleteMany({ where: { entityId: leftover.id } });
    await prisma.businessEntity.delete({ where: { id: leftover.id } });
  }
  const leftoverCat = await prisma.financialCategory.findFirst({ where: { name: "_TEST IN Salaries" } });
  if (leftoverCat) await prisma.financialCategory.delete({ where: { id: leftoverCat.id } });

  // An INR-based entity, mirroring the real India entity.
  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTINDIA", name: "_TEST India Entity", country: "India", baseCurrency: "INR" },
  });
  entityId = entity.id;

  const category = await prisma.financialCategory.create({ data: { name: "_TEST IN Salaries", sortOrder: 995 } });
  categoryId = category.id;
});

afterAll(async () => {
  if (!entityId) return;
  const txns = await prisma.financialTransaction.findMany({ where: { entityId } });
  const ids = txns.map((t) => t.id);
  await prisma.payment.deleteMany({ where: { transactionId: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  const clients = await prisma.client.findMany({ where: { entityId } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: clients.map((c) => c.id) } } });
  await prisma.client.deleteMany({ where: { entityId } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
  if (categoryId) await prisma.financialCategory.delete({ where: { id: categoryId } });
});

describe("India workbook import", () => {
  it("parses the Dubai-format sheet unchanged and writes every row as INR", async () => {
    const buffer = await buildIndiaWorkbook();

    // 1. The identical layout parses — no India-specific provider needed.
    const preview = await previewImport(buffer, entityId, 2026, 8);
    expect(preview.outflow.validRows).toHaveLength(2);
    expect(preview.inflow.validRows).toHaveLength(1);
    expect(preview.outflow.errors).toHaveLength(0);

    await commitImport({
      entityId,
      originalCurrency: "INR",
      outflowRows: preview.outflow.validRows,
      inflowRows: preview.inflow.validRows,
      sourceFileName: "_TEST_india.xlsx",
      actorId: userId,
      actorEmail: "test@example.com",
    });

    // 2. Currency is INR on every transaction — not AED inherited from the
    //    Dubai-shaped fixture.
    const written = await prisma.financialTransaction.findMany({ where: { entityId } });
    expect(written).toHaveLength(3);
    expect(written.every((t) => t.originalCurrency === "INR")).toBe(true);

    // 3. And on the payment rows too — those carry their own currency column,
    //    so a mismatch there would corrupt the ledger just as badly.
    const payments = await prisma.payment.findMany({
      where: { transactionId: { in: written.map((t) => t.id) } },
    });
    expect(payments.length).toBeGreaterThan(0);
    expect(payments.every((p) => p.currency === "INR")).toBe(true);

    // 4. Amounts survive at full INR magnitude (no scaling/truncation).
    const salary = written.find((t) => t.description === "_TEST IN Salary")!;
    expect(salary.originalAmount.toString()).toBe("250000");
    expect(salary.paidAmount.toString()).toBe("250000"); // Pay Full? = Y
    expect(salary.status).toBe("PAID");

    const rent = written.find((t) => t.description === "_TEST IN Rent")!;
    expect(rent.paidAmount.toString()).toBe("30000");
    expect(rent.status).toBe("PARTIAL");
  });
});
