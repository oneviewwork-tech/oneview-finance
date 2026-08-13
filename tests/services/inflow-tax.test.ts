import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getInflowSummary } from "@/services/finance/summary";

const RANGE = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };

let entityId: string;
let userId: string;

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  // A prior interrupted run can leave this fixture behind, which would fail
  // the unique constraint below and skip to a broken afterAll.
  const leftover = await prisma.businessEntity.findUnique({ where: { code: "_TESTINFLOWTAX" } });
  if (leftover) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftover.id } });
    await prisma.businessEntity.delete({ where: { id: leftover.id } });
  }

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTINFLOWTAX", name: "_TEST Inflow Tax Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  const base = {
    entityId,
    originalCurrency: "AED" as const,
    createdById: userId,
    transactionType: "INFLOW" as const,
    transactionDate: new Date(Date.UTC(2026, 7, 10)),
  };

  await prisma.financialTransaction.createMany({
    data: [
      // 1000 net + 50 tax = 1050 gross, fully paid.
      { ...base, originalAmount: "1050", taxAmount: "50", paidAmount: "1050", status: "PAID", description: "_TEST tax paid in full" },
      // 2000 net + 100 tax = 2100 gross, exactly half paid.
      { ...base, originalAmount: "2100", taxAmount: "100", paidAmount: "1050", status: "PARTIAL", description: "_TEST tax half paid" },
      // No tax at all — the shape every existing row has.
      { ...base, originalAmount: "500", taxAmount: "0", paidAmount: "500", status: "PAID", description: "_TEST no tax" },
      // Invoiced with tax, nothing received: no tax collected yet.
      { ...base, originalAmount: "630", taxAmount: "30", paidAmount: "0", status: "PENDING", description: "_TEST tax unpaid" },
    ],
  });
});

afterAll(async () => {
  // Guard against an unassigned entityId turning the filter below into a
  // no-op that would match — and delete — every transaction.
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
});

describe("getInflowSummary — tax is not revenue", () => {
  it("reports deal value net of tax", async () => {
    const s = await getInflowSummary(entityId, RANGE);
    // Gross 1050 + 2100 + 500 + 630 = 4280; tax 50 + 100 + 0 + 30 = 180.
    expect(s.grossDealValue.toString()).toBe("4280");
    expect(s.taxInvoiced.toString()).toBe("180");
    expect(s.totalDealValue.toString()).toBe("4100");
  });

  // The point of the proportional rule: half an invoice paid means half its
  // tax collected, not all of it and not none.
  it("collects tax in step with the client's payments", async () => {
    const s = await getInflowSummary(entityId, RANGE);
    // 50 (fully paid) + 50 (half of 100) + 0 + 0 = 100.
    expect(s.taxCollected.toNumber()).toBeCloseTo(100, 6);
    // Gross received 1050 + 1050 + 500 + 0 = 2600, less 100 tax = 2500.
    expect(s.grossReceived.toString()).toBe("2600");
    expect(s.totalReceived.toNumber()).toBeCloseTo(2500, 6);
  });

  // Receivables and collection rate must stay gross: the client owes the tax
  // too, so a fully paid invoice has to read as fully collected.
  it("keeps receivables and collection rate on the gross figures", async () => {
    const s = await getInflowSummary(entityId, RANGE);
    expect(s.balanceReceivable.toString()).toBe("1680"); // 4280 - 2600
    expect(s.collectionRate.toNumber()).toBeCloseTo(2600 / 4280, 6);
  });

  it("never collects tax on an unpaid invoice", async () => {
    const only = await prisma.financialTransaction.findFirstOrThrow({
      where: { entityId, description: "_TEST tax unpaid" },
    });
    expect(only.paidAmount.toString()).toBe("0");
    const s = await getInflowSummary(entityId, RANGE);
    // The 30 on that row is invoiced but not yet collected.
    expect(s.taxInvoiced.minus(s.taxCollected).toNumber()).toBeCloseTo(80, 6);
  });
});
