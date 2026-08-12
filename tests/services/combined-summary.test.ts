import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCombinedSummary, getFxBannerContext } from "@/services/finance/combined";

const RANGE = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };
const RATE_DATE = RANGE.to;

let entityId: string;
let userId: string;

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  // A prior interrupted run can leave this fixture behind, which would otherwise
  // fail the unique `code` constraint below and skip straight to a broken afterAll.
  const leftover = await prisma.businessEntity.findUnique({ where: { code: "_TESTCOMBINED" } });
  if (leftover) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftover.id } });
    await prisma.businessEntity.delete({ where: { id: leftover.id } });
  }

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTCOMBINED", name: "_TEST Combined Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  await prisma.exchangeRate.create({
    data: {
      baseCurrency: "AED",
      quoteCurrency: "INR",
      rate: "23",
      rateDate: RATE_DATE,
      source: "LIVE",
      sourceDetail: "_TEST fixed rate",
    },
  });

  const base = { entityId, originalCurrency: "AED" as const, createdById: userId };
  await prisma.financialTransaction.createMany({
    data: [
      {
        ...base,
        transactionType: "INFLOW",
        transactionDate: new Date(Date.UTC(2026, 7, 10)),
        originalAmount: "1000",
        paidAmount: "1000",
        status: "PAID",
        description: "_TEST combined inflow",
      },
      {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: new Date(Date.UTC(2026, 7, 12)),
        originalAmount: "500",
        paidAmount: "200",
        status: "PARTIAL",
        description: "_TEST combined outflow",
      },
    ],
  });
});

afterAll(async () => {
  // Guard against an unassigned entityId (beforeAll threw before assigning it) turning
  // the filter below into a no-op that would match — and delete — every transaction.
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.exchangeRate.deleteMany({ where: { sourceDetail: { contains: "_TEST" } } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
});

describe("getCombinedSummary", () => {
  it("converts a native-AED entity's figures into the reporting currency using the period's own rate", async () => {
    const result = await getCombinedSummary("INR", RANGE);
    const row = result.rows.find((r) => r.native.entityId === entityId)!;

    expect(row.converted.available).toBe(true);
    expect(row.converted.rate?.toString()).toBe("23");
    // native: inflow received 1000 AED, outflow paid 200 AED
    expect(row.converted.totalInflow.toString()).toBe("23000");
    expect(row.converted.outflowPaid.toString()).toBe("4600");
    expect(row.converted.netPosition.toString()).toBe("18400");

    expect(result.combined.available).toBe(true);
    if (result.combined.available) {
      // Combined includes UAE/India too (currently zero real transactions) — assert
      // it at least reflects this entity's contribution rather than asserting an
      // exact grand total that depends on those entities staying empty forever.
      expect(result.combined.totalInflow.gte("23000")).toBe(true);
      expect(result.combined.netPosition.gte("18400")).toBe(true);
    }
  });

  it("passes through unchanged when reporting currency matches the entity's native currency", async () => {
    const result = await getCombinedSummary("AED", RANGE);
    const row = result.rows.find((r) => r.native.entityId === entityId)!;
    expect(row.converted.totalInflow.toString()).toBe("1000");
    expect(row.converted.rate?.toString()).toBe("1");
  });

  it("flags the combined total unavailable — never silently zero — when a rate is missing for any entity", async () => {
    const noRateRange = { from: new Date(Date.UTC(1999, 0, 1)), to: new Date(Date.UTC(1999, 0, 31)) };
    // Give this entity a transaction in the no-rate period so it's included in the summary.
    await prisma.financialTransaction.create({
      data: {
        entityId,
        originalCurrency: "AED",
        createdById: userId,
        transactionType: "INFLOW",
        transactionDate: new Date(Date.UTC(1999, 0, 10)),
        originalAmount: "500",
        paidAmount: "500",
        status: "PAID",
        description: "_TEST no-rate-period inflow",
      },
    });

    const result = await getCombinedSummary("INR", noRateRange);
    const row = result.rows.find((r) => r.native.entityId === entityId)!;
    expect(row.converted.available).toBe(false);
    expect(result.combined.available).toBe(false);
  });
});

describe("getFxBannerContext", () => {
  it("reports the resolved AED->INR rate for a date it has data for", async () => {
    const result = await getFxBannerContext(RATE_DATE);
    expect(result.available).toBe(true);
    expect(result.aedToInrRate?.toString()).toBe("23");
  });

  it("reports unavailable for a date with no rate history at all", async () => {
    const result = await getFxBannerContext(new Date(Date.UTC(1999, 0, 1)));
    expect(result.available).toBe(false);
  });
});
