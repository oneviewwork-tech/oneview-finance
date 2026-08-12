import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDepartmentPaymentStatus } from "@/services/finance/summary";

const RANGE = { from: new Date(Date.UTC(2026, 7, 1)), to: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)) };

let entityId: string;
let userId: string;
let deptAId: string;
let deptBId: string;
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
  for (const name of ["_TEST Dept A", "_TEST Dept B", "_TEST Dept Unused"]) {
    const leftoverDept = await prisma.department.findUnique({ where: { name } });
    if (leftoverDept) await prisma.department.delete({ where: { id: leftoverDept.id } });
  }

  const entity = await prisma.businessEntity.create({
    data: { code: "_TESTDEPTSUMMARY", name: "_TEST Dept Summary Entity", country: "Testland", baseCurrency: "AED" },
  });
  entityId = entity.id;

  const [deptA, deptB, deptUnused] = await Promise.all([
    prisma.department.create({ data: { name: "_TEST Dept A", sortOrder: 900 } }),
    prisma.department.create({ data: { name: "_TEST Dept B", sortOrder: 901 } }),
    prisma.department.create({ data: { name: "_TEST Dept Unused", sortOrder: 902 } }),
  ]);
  deptAId = deptA.id;
  deptBId = deptB.id;
  deptUntaggedId = deptUnused.id;

  const base = { entityId, originalCurrency: "AED" as const, createdById: userId, transactionType: "OUTFLOW" as const };

  await prisma.financialTransaction.createMany({
    data: [
      // Dept A — both fully paid.
      { ...base, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 3)), originalAmount: "1000", paidAmount: "1000", status: "PAID", description: "_TEST dept A salary 1" },
      { ...base, departmentId: deptAId, transactionDate: new Date(Date.UTC(2026, 7, 10)), originalAmount: "500", paidAmount: "500", status: "PAID", description: "_TEST dept A salary 2" },
      // Dept B — one paid, one still pending: delayed.
      { ...base, departmentId: deptBId, transactionDate: new Date(Date.UTC(2026, 7, 4)), originalAmount: "800", paidAmount: "800", status: "PAID", description: "_TEST dept B salary 1" },
      { ...base, departmentId: deptBId, transactionDate: new Date(Date.UTC(2026, 7, 12)), originalAmount: "300", paidAmount: "0", status: "PENDING", description: "_TEST dept B salary 2" },
      // Untagged outflow — no department at all, must not be attributed to any department row.
      { ...base, departmentId: null, transactionDate: new Date(Date.UTC(2026, 7, 6)), originalAmount: "200", paidAmount: "200", status: "PAID", description: "_TEST untagged expense" },
    ],
  });
});

afterAll(async () => {
  // Guard against an unassigned entityId (beforeAll threw before assigning it) turning
  // the filter below into a no-op that would match — and delete — every transaction.
  if (!entityId) return;
  await prisma.financialTransaction.deleteMany({ where: { entityId } });
  await prisma.businessEntity.delete({ where: { id: entityId } });
  if (deptAId) await prisma.department.delete({ where: { id: deptAId } });
  if (deptBId) await prisma.department.delete({ where: { id: deptBId } });
  if (deptUntaggedId) await prisma.department.delete({ where: { id: deptUntaggedId } });
});

describe("getDepartmentPaymentStatus", () => {
  it("reports which departments are fully paid vs delayed, and excludes departments with no activity", async () => {
    const rows = await getDepartmentPaymentStatus(entityId, RANGE);

    // Dept Unused has zero transactions in range — must not appear at all.
    expect(rows.find((r) => r.departmentId === deptUntaggedId)).toBeUndefined();
    expect(rows).toHaveLength(2);

    const deptA = rows.find((r) => r.departmentId === deptAId)!;
    expect(deptA.itemCount).toBe(2);
    expect(deptA.paidItemCount).toBe(2);
    expect(deptA.totalDue.toString()).toBe("1500");
    expect(deptA.paid.toString()).toBe("1500");
    expect(deptA.pending.toString()).toBe("0");
    expect(deptA.fullyPaid).toBe(true);

    const deptB = rows.find((r) => r.departmentId === deptBId)!;
    expect(deptB.itemCount).toBe(2);
    expect(deptB.paidItemCount).toBe(1);
    expect(deptB.pendingItemCount).toBe(1);
    expect(deptB.totalDue.toString()).toBe("1100");
    expect(deptB.paid.toString()).toBe("800");
    expect(deptB.pending.toString()).toBe("300");
    expect(deptB.fullyPaid).toBe(false);
  });
});
