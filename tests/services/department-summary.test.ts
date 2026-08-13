import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDepartmentPerformance } from "@/services/finance/summary";

const RANGE = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };

let entityId: string;
let userId: string;
let deptAId: string; // earns more than it spends, fully collected
let deptBId: string; // earns, but clients haven't fully paid
let deptCId: string; // outflow only — a pure cost centre
let deptUntaggedId: string; // has a Department row but zero transactions in range — must not appear

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  userId = admin.id;

  // A prior interrupted run can leave these fixtures behind, which would otherwise
  // fail the unique constraints below and skip straight to a broken afterAll.
  const leftoverEntity = await prisma.businessEntity.findUnique({ where: { code: "_TESTDEPTSUMMARY" } });
  if (leftoverEntity) {
    await prisma.financialTransaction.deleteMany({ where: { entityId: leftoverEntity.id } });
    await prisma.businessEntity.delete({ where: { id: leftoverEntity.id } });
  }
  for (const name of ["_TEST Dept A", "_TEST Dept B", "_TEST Dept C", "_TEST Dept Unused"]) {
    const leftoverDept = await prisma.department.findUnique({ where: { name } });
    if (leftoverDept) await prisma.department.delete({ where: { id: leftoverDept.id } });
  }

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTDEPTSUMMARY", name: "_TEST Dept Summary Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  const [deptA, deptB, deptC, deptUnused] = await Promise.all([
    prisma.department.create({ data: { name: "_TEST Dept A", sortOrder: 900 } }),
    prisma.department.create({ data: { name: "_TEST Dept B", sortOrder: 901 } }),
    prisma.department.create({ data: { name: "_TEST Dept C", sortOrder: 902 } }),
    prisma.department.create({ data: { name: "_TEST Dept Unused", sortOrder: 903 } }),
  ]);
  deptAId = deptA.id;
  deptBId = deptB.id;
  deptCId = deptC.id;
  deptUntaggedId = deptUnused.id;

  const base = { entityId, originalCurrency: "AED" as const, createdById: userId };
  const inflow = { ...base, transactionType: "INFLOW" as const };
  const outflow = { ...base, transactionType: "OUTFLOW" as const };

  await prisma.financialTransaction.createMany({
    data: [
      // Dept A — earns 5000 (all collected), spends 1500. Net +3500.
      { ...inflow, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 2)), originalAmount: "3000", paidAmount: "3000", status: "PAID", description: "_TEST A deal 1" },
      { ...inflow, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 9)), originalAmount: "2000", paidAmount: "2000", status: "PAID", description: "_TEST A deal 2" },
      { ...outflow, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 3)), originalAmount: "1000", paidAmount: "1000", status: "PAID", description: "_TEST A cost 1" },
      { ...outflow, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 10)), originalAmount: "500", paidAmount: "500", status: "PAID", description: "_TEST A cost 2" },

      // Dept B — earns 4000 but only 1000 collected, spends 800. Net +3200 on
      // accrual, yet only 25% of the money is actually in.
      { ...inflow, departmentId: deptBId, transactionDate: new Date(Date.UTC(2026, 7, 4)), originalAmount: "4000", paidAmount: "1000", status: "PARTIAL", description: "_TEST B deal 1" },
      { ...outflow, departmentId: deptBId, transactionDate: new Date(Date.UTC(2026, 7, 12)), originalAmount: "800", paidAmount: "0", status: "PENDING", description: "_TEST B cost 1" },

      // Dept C — spends 900, earns nothing. The case the old outflow-only
      // panel made every department look like.
      { ...outflow, departmentId: deptCId, transactionDate: new Date(Date.UTC(2026, 7, 5)), originalAmount: "900", paidAmount: "400", status: "PARTIAL", description: "_TEST C cost 1" },

      // Untagged rows in both directions — must not be attributed to any department.
      { ...inflow, departmentId: null, transactionDate: new Date(Date.UTC(2026, 7, 6)), originalAmount: "7777", paidAmount: "7777", status: "PAID", description: "_TEST untagged deal" },
      { ...outflow, departmentId: null, transactionDate: new Date(Date.UTC(2026, 7, 6)), originalAmount: "200", paidAmount: "200", status: "PAID", description: "_TEST untagged expense" },

      // Outside the range — proves the range filter applies to both directions.
      { ...inflow, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 6, 15)), originalAmount: "9999", paidAmount: "9999", status: "PAID", description: "_TEST A prior month deal" },
    ],
  });
});

afterAll(async () => {
  // Guard against an unassigned entityId (beforeAll threw before assigning it) turning
  // the filter below into a no-op that would match — and delete — every transaction.
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
  for (const id of [deptAId, deptBId, deptCId, deptUntaggedId]) {
    if (id) await prisma.department.delete({ where: { id } });
  }
});

describe("getDepartmentPerformance", () => {
  it("reports what each department earned as well as what it spent", async () => {
    const rows = await getDepartmentPerformance(entityId, RANGE);

    const deptA = rows.find((r) => r.departmentId === deptAId)!;
    expect(deptA.earned.toString()).toBe("5000");
    expect(deptA.received.toString()).toBe("5000");
    expect(deptA.spent.toString()).toBe("1500");
    expect(deptA.paidOut.toString()).toBe("1500");
    expect(deptA.net.toString()).toBe("3500");
    expect(deptA.inflowCount).toBe(2);
    expect(deptA.outflowCount).toBe(2);
    expect(deptA.fullyCollected).toBe(true);
  });

  // The distinction the single "net" number hides: B looks healthy on accrual
  // but has only a quarter of the cash in the door.
  it("separates what was billed from what was actually collected", async () => {
    const rows = await getDepartmentPerformance(entityId, RANGE);
    const deptB = rows.find((r) => r.departmentId === deptBId)!;

    expect(deptB.earned.toString()).toBe("4000");
    expect(deptB.received.toString()).toBe("1000");
    expect(deptB.outstanding.toString()).toBe("3000");
    expect(deptB.collectedFraction.toString()).toBe("0.25");
    expect(deptB.fullyCollected).toBe(false);

    expect(deptB.spent.toString()).toBe("800");
    expect(deptB.owing.toString()).toBe("800");
    expect(deptB.net.toString()).toBe("3200");
  });

  it("shows a cost-only department without dividing by zero", async () => {
    const rows = await getDepartmentPerformance(entityId, RANGE);
    const deptC = rows.find((r) => r.departmentId === deptCId)!;

    expect(deptC.earned.toString()).toBe("0");
    expect(deptC.collectedFraction.toString()).toBe("0");
    expect(deptC.spent.toString()).toBe("900");
    expect(deptC.net.toString()).toBe("-900");
    expect(deptC.inflowCount).toBe(0);
    // Nothing was billed, so "fully collected" would be a false green tick.
    expect(deptC.fullyCollected).toBe(false);
  });

  it("excludes departments with no activity, and untagged rows entirely", async () => {
    const rows = await getDepartmentPerformance(entityId, RANGE);

    expect(rows.find((r) => r.departmentId === deptUntaggedId)).toBeUndefined();
    expect(rows).toHaveLength(3);

    // The untagged 7777 inflow / 200 outflow belong to no department, so they
    // must not appear in any row — department totals deliberately don't
    // reconcile to entity totals.
    const totalEarned = rows.reduce((sum, r) => sum.plus(r.earned), rows[0].earned.minus(rows[0].earned));
    expect(totalEarned.toString()).toBe("9000"); // 5000 + 4000, not 16777
  });

  it("applies the date range to inflow as well as outflow", async () => {
    const rows = await getDepartmentPerformance(entityId, RANGE);
    const deptA = rows.find((r) => r.departmentId === deptAId)!;
    // The 9999 July deal is outside the August range.
    expect(deptA.earned.toString()).toBe("5000");
  });
});
