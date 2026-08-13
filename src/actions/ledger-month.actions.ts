"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEntityWrite } from "@/lib/rbac";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-result";
import { parsePeriodKey, periodLabel, formatPeriodKey } from "@/domain/finance/period";

/**
 * Opens a month so it can be filled in — the app's equivalent of starting a
 * new workbook file for August.
 *
 * Idempotent: creating a month that already exists (or that already has rows
 * under it) returns success rather than an error, because from the user's
 * point of view the month is now there either way, which is what they asked
 * for.
 */
export async function createLedgerMonth(entityCode: string, periodKey: string): Promise<ActionResult<{ key: string }>> {
  const period = parsePeriodKey(periodKey);
  if (!period) return actionError("Pick a valid month");

  const entity = await prisma.businessEntity.findUnique({ where: { code: entityCode.toUpperCase() } });
  if (!entity) return actionError("Entity not found");

  // Write permission, not read: creating a month is a change to the books,
  // and a viewer must not be able to make one.
  const actor = await requireEntityWrite(entity.code);

  await prisma.ledgerMonth.upsert({
    where: { entityId_year_month: { entityId: entity.id, year: period.year, month: period.month } },
    update: {},
    create: { entityId: entity.id, year: period.year, month: period.month, createdById: actor.id },
  });

  revalidatePath(`/operations/${entityCode}/inflow`);
  revalidatePath(`/operations/${entityCode}/outflow`);
  return actionSuccess({ key: formatPeriodKey(period) });
}

/**
 * Removes an empty month shell.
 *
 * Refuses when the month holds rows: this is meant to undo a mistyped
 * "create month", not to be a bulk delete for real entries. Deleting the
 * shell of a month that has transactions would also do nothing useful —
 * the month would immediately reappear as a card, derived from its rows.
 */
export async function deleteLedgerMonth(entityCode: string, periodKey: string): Promise<ActionResult> {
  const period = parsePeriodKey(periodKey);
  if (!period) return actionError("Pick a valid month");

  const entity = await prisma.businessEntity.findUnique({ where: { code: entityCode.toUpperCase() } });
  if (!entity) return actionError("Entity not found");
  await requireEntityWrite(entity.code);

  const { periodRange } = await import("@/domain/finance/period");
  const range = periodRange(period);
  const rowCount = await prisma.financialTransaction.count({
    where: { entityId: entity.id, transactionDate: { gte: range.from, lte: range.to } },
  });
  if (rowCount > 0) {
    return actionError(
      `${periodLabel(period)} has ${rowCount} entr${rowCount === 1 ? "y" : "ies"}. Delete those first if you really mean to remove the month.`
    );
  }

  await prisma.ledgerMonth.deleteMany({
    where: { entityId: entity.id, year: period.year, month: period.month },
  });

  revalidatePath(`/operations/${entityCode}/inflow`);
  revalidatePath(`/operations/${entityCode}/outflow`);
  return actionSuccess(undefined);
}
