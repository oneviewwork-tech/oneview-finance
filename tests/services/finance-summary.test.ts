import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getCategorySummary,
  getDashboardOverview,
  getEntitySummary,
  getInflowSummary,
  getMonthlySummary,
  getNetPosition,
  getOutflowSummary,
  getReceivables,
  getWeeklySummary,
} from "@/services/finance/summary";

// Integration tests — the category/weekly summaries use raw SQL with
// Postgres-specific date math (FILTER, EXTRACT, date_trunc) that a mock
// can't meaningfully exercise, so these run against the real dev database.
// Everything is scoped to a dedicated throwaway entity so it can never
// affect real UAE/India figures, and is deleted in afterAll.

const AUG = (day: number) => new Date(Date.UTC(2026, 7, day));
const RANGE = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };

let entityId: string;
let categorySalaries: string;
let categoryRent: string;
let expenseTypeCurrent: string;
let expenseTypeArrears: string;
let userId: string;
let txnIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  // A prior interrupted run can leave this fixture behind, which would otherwise
  // fail the unique `code` constraint below and skip straight to a broken afterAll.
  const leftover = await prisma.businessEntity.findUnique({ where: { code: "_TESTSUMMARY" } });
  if (leftover) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftover.id } });
    await prisma.client.deleteMany({ where: { entityId: leftover.id } });
    await prisma.businessEntity.delete({ where: { id: leftover.id } });
  }

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTSUMMARY", name: "_TEST Summary Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  // upsert (not create) — a prior run's leftover afterAll-skip can leave these
  // names behind, and colliding with them here shouldn't fail the whole suite.
  const [salaries, rent, current, arrears] = await Promise.all([
    prisma.financialCategory.upsert({ where: { name: "_TEST Salaries" }, update: {}, create: { name: "_TEST Salaries", sortOrder: 900 } }),
    prisma.financialCategory.upsert({ where: { name: "_TEST Rent" }, update: {}, create: { name: "_TEST Rent", sortOrder: 901 } }),
    prisma.expenseType.upsert({ where: { name: "_TEST Current" }, update: {}, create: { name: "_TEST Current", sortOrder: 900 } }),
    prisma.expenseType.upsert({ where: { name: "_TEST Arrears" }, update: {}, create: { name: "_TEST Arrears", sortOrder: 901 } }),
  ]);
  categorySalaries = salaries.id;
  categoryRent = rent.id;
  expenseTypeCurrent = current.id;
  expenseTypeArrears = arrears.id;

  const newClientType = await prisma.clientType.findFirstOrThrow({ where: { name: "New Client" } });
  const existingClientType = await prisma.clientType.findFirstOrThrow({ where: { name: "Existing Client" } });

  const [clientNew, clientExisting] = await Promise.all([
    prisma.client.create({ data: { entityId, name: "_TEST Client New", clientTypeId: newClientType.id } }),
    prisma.client.create({ data: { entityId, name: "_TEST Client Existing", clientTypeId: existingClientType.id } }),
  ]);

  const base = { entityId, originalCurrency: "AED" as const, createdById: userId };

  const created = await prisma.$transaction([
    // Outflow — Salaries: week1 PAID, week2 PARTIAL, week3 PENDING (Arrears)
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: AUG(3),
        originalAmount: "1000",
        paidAmount: "1000",
        status: "PAID",
        categoryId: categorySalaries,
        expenseTypeId: expenseTypeCurrent,
        description: "_TEST week1 salary",
      },
    }),
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: AUG(10),
        originalAmount: "2000",
        paidAmount: "500",
        status: "PARTIAL",
        categoryId: categorySalaries,
        expenseTypeId: expenseTypeCurrent,
        description: "_TEST week2 salary",
      },
    }),
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: AUG(20),
        originalAmount: "1500",
        paidAmount: "0",
        status: "PENDING",
        categoryId: categorySalaries,
        expenseTypeId: expenseTypeArrears,
        description: "_TEST week3 arrears",
      },
    }),
    // Outflow — Rent: week4 PAID
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "OUTFLOW",
        transactionDate: AUG(25),
        originalAmount: "3000",
        paidAmount: "3000",
        status: "PAID",
        categoryId: categoryRent,
        expenseTypeId: expenseTypeCurrent,
        description: "_TEST week4 rent",
      },
    }),
    // Inflow — one PAID (new client), one PARTIAL (existing client)
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "INFLOW",
        transactionDate: AUG(5),
        originalAmount: "5000",
        paidAmount: "5000",
        status: "PAID",
        clientId: clientNew.id,
        description: "_TEST new client deal",
      },
    }),
    prisma.financialTransaction.create({
      data: {
        ...base,
        transactionType: "INFLOW",
        transactionDate: AUG(15),
        originalAmount: "10000",
        paidAmount: "4000",
        status: "PARTIAL",
        clientId: clientExisting.id,
        description: "_TEST existing client deal",
      },
    }),
  ]);
  txnIds = created.map((t) => t.id);
});

afterAll(async () => {
  // If beforeAll threw before assigning these, an unguarded deleteMany({ where: { entityId } })
  // becomes deleteMany({}) — Prisma treats an undefined filter value as "no filter" — which
  // would wipe every row in the table instead of just this fixture. Never let that happen.
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.client.deleteMany({ where: { entityId } });
  if (categorySalaries && categoryRent) {
    await prisma.financialCategory.deleteMany({ where: { id: { in: [categorySalaries, categoryRent] } } });
  }
  if (expenseTypeCurrent && expenseTypeArrears) {
    await prisma.expenseType.deleteMany({ where: { id: { in: [expenseTypeCurrent, expenseTypeArrears] } } });
  }
  await prisma.businessEntity.delete({ where: { id: entityId } });
});

describe("getInflowSummary", () => {
  it("matches the Dashboard's INFLOW SUMMARY block exactly", async () => {
    const result = await getInflowSummary(entityId, RANGE);
    expect(result.totalDealValue.toString()).toBe("15000");
    expect(result.totalReceived.toString()).toBe("9000");
    expect(result.balanceReceivable.toString()).toBe("6000");
    expect(result.collectionRate.toString()).toBe("0.6");
    expect(result.clientsClosed).toBe(2);
    expect(result.newClientsClosed).toBe(1);
    expect(result.existingOrRepeatClientsClosed).toBe(1);
    expect(result.averageDealSize.toString()).toBe("7500");
  });
});

describe("getOutflowSummary", () => {
  it("matches the Dashboard's TOTAL OUTFLOW/PAID/PENDING", async () => {
    const result = await getOutflowSummary(entityId, RANGE);
    expect(result.totalDue.toString()).toBe("7500");
    expect(result.totalPaid.toString()).toBe("4500");
    expect(result.totalPending.toString()).toBe("3000");
    expect(result.percentSettled.toString()).toBe("0.6");
    expect(result.itemCount).toBe(4);
  });
});

describe("getNetPosition", () => {
  it("is Inflow received minus Outflow paid, not a profit calculation", async () => {
    const result = await getNetPosition(entityId, RANGE);
    expect(result.totalInflow.toString()).toBe("9000");
    expect(result.outflowPaid.toString()).toBe("4500");
    expect(result.netPosition.toString()).toBe("4500");
  });
});

describe("getReceivables", () => {
  it("totals across all inflow and lists only the open (not-PAID) ones", async () => {
    const result = await getReceivables(entityId, RANGE);
    expect(result.totalReceivables.toString()).toBe("6000");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].clientName).toBe("_TEST Client Existing");
    expect(result.rows[0].balanceDue.toString()).toBe("6000");
  });
});

describe("getCategorySummary", () => {
  it("aggregates per category with WEEK 1-4 breakdown via Postgres date bucketing", async () => {
    const result = await getCategorySummary(entityId, RANGE);
    const salaries = result.find((r) => r.categoryId === categorySalaries)!;
    const rent = result.find((r) => r.categoryId === categoryRent)!;

    expect(salaries.totalDue.toString()).toBe("4500");
    expect(salaries.paid.toString()).toBe("1500");
    expect(salaries.pending.toString()).toBe("3000");
    expect(salaries.week1.toString()).toBe("1000");
    expect(salaries.week2.toString()).toBe("2000");
    expect(salaries.week3.toString()).toBe("1500");
    expect(salaries.week4.toString()).toBe("0");

    expect(rent.totalDue.toString()).toBe("3000");
    expect(rent.week4.toString()).toBe("3000");
    expect(rent.week1.toString()).toBe("0");
  });
});

describe("getWeeklySummary", () => {
  it("buckets by week, and breaks down by Type and Status", async () => {
    const result = await getWeeklySummary(entityId, RANGE);

    expect(result.weeks).toHaveLength(4);
    const [w1, w2, w3, w4] = result.weeks;
    expect(w1).toMatchObject({ week: 1, items: 1 });
    expect(w1.totalDue.toString()).toBe("1000");
    expect(w1.pending.toString()).toBe("0");
    expect(w2.totalDue.toString()).toBe("2000");
    expect(w2.pending.toString()).toBe("1500");
    expect(w3.totalDue.toString()).toBe("1500");
    expect(w3.paid.toString()).toBe("0");
    expect(w4.totalDue.toString()).toBe("3000");

    // percentOfMonth is relative to the grand total due (7500) for this entity/range.
    expect(Number(w1.percentOfMonth.toString())).toBeCloseTo(1000 / 7500, 6);

    const current = result.byType.find((t) => t.expenseTypeName === "_TEST Current")!;
    const arrears = result.byType.find((t) => t.expenseTypeName === "_TEST Arrears")!;
    expect(current.totalDue.toString()).toBe("6000");
    expect(current.paid.toString()).toBe("4500");
    expect(arrears.totalDue.toString()).toBe("1500");
    expect(arrears.paid.toString()).toBe("0");

    const paidStatus = result.byStatus.find((s) => s.status === "PAID")!;
    const partialStatus = result.byStatus.find((s) => s.status === "PARTIAL")!;
    const pendingStatus = result.byStatus.find((s) => s.status === "PENDING")!;
    expect(paidStatus.items).toBe(2);
    expect(paidStatus.totalDue.toString()).toBe("4000");
    expect(partialStatus.items).toBe(1);
    expect(pendingStatus.items).toBe(1);
  });
});

describe("getMonthlySummary", () => {
  it("aggregates INFLOW/OUTFLOW per calendar month", async () => {
    const result = await getMonthlySummary(entityId);
    const august = result.find((r) => r.monthKey === "2026-08")!;
    expect(august).toBeDefined();
    expect(august.totalInflow.toString()).toBe("9000");
    expect(august.totalOutflowDue.toString()).toBe("7500");
    expect(august.outflowPaid.toString()).toBe("4500");
    expect(august.outflowPending.toString()).toBe("3000");
    expect(august.netPosition.toString()).toBe("4500");
  });
});

describe("getEntitySummary", () => {
  it("includes the test entity with correct native-currency figures, uncombined with any other entity", async () => {
    const result = await getEntitySummary(RANGE);
    const row = result.find((r) => r.entityId === entityId)!;
    expect(row).toBeDefined();
    expect(row.currency).toBe("AED");
    expect(row.totalInflow.toString()).toBe("9000");
    expect(row.netPosition.toString()).toBe("4500");
    expect(row.clientsClosed).toBe(2);
  });
});

describe("getDashboardOverview", () => {
  it("matches the workbook's exact top-level KPI set", async () => {
    const result = await getDashboardOverview(entityId, RANGE);
    expect(result.totalInflowReceived.toString()).toBe("9000");
    expect(result.totalOutflowDue.toString()).toBe("7500");
    expect(result.outflowPaid.toString()).toBe("4500");
    expect(result.outflowPending.toString()).toBe("3000");
    expect(result.netPosition.toString()).toBe("4500");
    expect(result.percentOutflowSettled.toString()).toBe("0.6");
    expect(result.receivables.toString()).toBe("6000");
    expect(result.clientsClosed).toBe(2);
  });
});
