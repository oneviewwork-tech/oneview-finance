"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEntityWrite } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-result";
import { calculateStatus } from "@/domain/finance/calculations";
import { parsePeriodKey, periodRange, periodFirstDay, dateForWeekOfMonth, periodFromDate } from "@/domain/finance/period";

const { Decimal } = Prisma;

/**
 * The fields a grid cell can change. Everything optional: the grid sends
 * only what the user actually touched, so two people editing different
 * columns of the same row don't clobber each other's work.
 */
export interface LedgerRowPatch {
  transactionDate?: string;
  description?: string;
  categoryId?: string | null;
  expenseTypeId?: string | null;
  departmentId?: string | null;
  clientId?: string | null;
  /** Inflow only — creates the client if the typed name is new. */
  clientName?: string;
  closedByName?: string;
  referenceNumber?: string;
  remarks?: string;
  /** Amount Due (outflow) / Deal Value (inflow). */
  amount?: string;
  /** Amount Paid (outflow) / Received (inflow). */
  paidAmount?: string;
  /**
   * Payment Tracker's Week column. The sheet has no expense date — only a
   * week bucket — so this maps to transactionDate through the same
   * conversion the importer uses, keeping both directions consistent.
   */
  week?: string;
  /** Pay Full? — the sheet's "type Y and it settles" shortcut. */
  payFull?: string;
  /** Mode, and Date Paid: both live on the payment, not the transaction. */
  paymentMethodId?: string | null;
  paymentDate?: string;
  /** Client Type is a property of the client the row points at. */
  clientTypeId?: string | null;
}

function toDecimal(value: string | undefined): Prisma.Decimal | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return new Decimal(0);
  // A cell can hold anything someone types; reject rather than storing NaN.
  if (!/^-?\d*\.?\d*$/.test(trimmed)) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Brings a transaction's payment ledger in line with a typed "Amount Paid".
 *
 * The workbook treats Amount Paid as a number you overwrite; this app keeps
 * an audited Payment ledger whose sum IS the paid amount. Reconciling by
 * writing a delta row — including a negative one when the figure is
 * corrected downward — keeps both true at once: the cell behaves like a
 * spreadsheet cell, and the history of how it got there survives. A
 * contra entry is how a ledger records a correction; silently rewriting
 * past payments would destroy the audit trail this system exists to keep.
 */
async function reconcilePaidAmount(
  tx: Prisma.TransactionClient,
  transactionId: string,
  currency: "AED" | "INR",
  target: Prisma.Decimal,
  actorId: string,
  when: Date,
  paymentMethodId?: string | null
): Promise<Prisma.Decimal> {
  const current = await tx.payment.aggregate({
    where: { transactionId },
    _sum: { amount: true },
  });
  const paid = current._sum.amount ?? new Decimal(0);
  const delta = target.minus(paid);
  if (!delta.eq(0)) {
    await tx.payment.create({
      data: {
        transactionId,
        amount: delta,
        currency,
        paymentDate: when,
        paymentMethodId: paymentMethodId ?? undefined,
        notes: delta.lt(0) ? "Correction entered on the monthly sheet" : null,
        createdById: actorId,
      },
    });
  }
  return target;
}

async function loadWritableRow(id: string) {
  const row = await prisma.financialTransaction.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!row) return null;
  return row;
}

export async function updateLedgerRow(id: string, patch: LedgerRowPatch): Promise<ActionResult<{ paidAmount: string; amount: string; status: string }>> {
  const row = await loadWritableRow(id);
  if (!row) return actionError("That row no longer exists — refresh the sheet.");
  const actor = await requireEntityWrite(row.entity.code);

  const data: Prisma.FinancialTransactionUpdateInput = {};

  if (patch.transactionDate !== undefined) {
    const d = parseDateOnly(patch.transactionDate);
    if (!d) return actionError("Enter the date as YYYY-MM-DD");
    data.transactionDate = d;
  }
  if (patch.description !== undefined) {
    const desc = patch.description.trim();
    if (!desc) return actionError(row.transactionType === "INFLOW" ? "Service / Project is required" : "Expense item is required");
    data.description = desc.slice(0, 300);
  }
  if (patch.referenceNumber !== undefined) data.referenceNumber = patch.referenceNumber.trim().slice(0, 120) || null;
  if (patch.remarks !== undefined) data.remarks = patch.remarks.trim().slice(0, 1000) || null;
  if (patch.closedByName !== undefined) data.closedByName = patch.closedByName.trim().slice(0, 200) || null;

  if (patch.categoryId !== undefined) data.category = patch.categoryId ? { connect: { id: patch.categoryId } } : { disconnect: true };
  if (patch.expenseTypeId !== undefined) data.expenseType = patch.expenseTypeId ? { connect: { id: patch.expenseTypeId } } : { disconnect: true };
  if (patch.departmentId !== undefined) data.department = patch.departmentId ? { connect: { id: patch.departmentId } } : { disconnect: true };
  if (patch.clientId !== undefined) data.client = patch.clientId ? { connect: { id: patch.clientId } } : { disconnect: true };

  let amount = row.originalAmount;
  if (patch.amount !== undefined) {
    const parsed = toDecimal(patch.amount);
    if (!parsed) return actionError("Enter a number");
    if (parsed.lt(0)) return actionError("Amount can't be negative");
    amount = parsed;
    data.originalAmount = parsed;
  }

  let paid = row.paidAmount;
  if (patch.paidAmount !== undefined) {
    const parsed = toDecimal(patch.paidAmount);
    if (!parsed) return actionError("Enter a number");
    if (parsed.lt(0)) return actionError("Paid can't be negative");
    // The sheet's own rule: you can't pay more than is owed.
    if (parsed.gt(amount)) return actionError("Paid can't exceed the amount due");
    paid = parsed;
  }

  // Payment Tracker has no expense date of its own — only a week bucket.
  // Mapped through the same conversion the importer uses, so a row edited
  // here and a row imported from the workbook land on the same date.
  if (patch.week !== undefined) {
    const w = Number(patch.week);
    if (![1, 2, 3, 4].includes(w)) return actionError("Pick a week");
    const p = periodFromDate(row.transactionDate);
    data.transactionDate = dateForWeekOfMonth(p.year, p.month, w as 1 | 2 | 3 | 4);
  }

  // The sheet's "type Y and it settles" shortcut. Y sets paid to the full
  // amount due; N clears it back to nothing, which is what the workbook's
  // own formula does when you blank the cell.
  if (patch.payFull !== undefined) {
    paid = patch.payFull.trim().toUpperCase() === "Y" ? amount : new Decimal(0);
  }

  const before = { amount: row.originalAmount.toString(), paid: row.paidAmount.toString(), status: row.status };

  const result = await prisma.$transaction(async (tx) => {
    // Client Type is a column on the sheet but a property of the client, so
    // setting it here updates the client this row points at.
    if (patch.clientTypeId !== undefined && row.clientId) {
      await tx.client.update({
        where: { id: row.clientId },
        data: { clientTypeId: patch.clientTypeId || null },
      });
    }

    if (patch.paidAmount !== undefined || patch.payFull !== undefined) {
      await reconcilePaidAmount(
        tx,
        id,
        row.originalCurrency,
        paid,
        actor.id,
        row.transactionDate,
        patch.paymentMethodId
      );
    }

    // Mode and Date Paid describe the payment, not the transaction, so they
    // amend the most recent one. With nothing paid yet there is no payment
    // to describe — the cell is accepted but has nowhere to land until an
    // amount is entered, which matches the sheet (both columns stay blank
    // until something is paid).
    if (patch.paymentMethodId !== undefined || patch.paymentDate !== undefined) {
      const latest = await tx.payment.findFirst({
        where: { transactionId: id },
        orderBy: { paymentDate: "desc" },
      });
      if (latest) {
        const paymentDate = patch.paymentDate ? parseDateOnly(patch.paymentDate) : null;
        if (patch.paymentDate !== undefined && !paymentDate) {
          throw new Error("INVALID_PAYMENT_DATE");
        }
        await tx.payment.update({
          where: { id: latest.id },
          data: {
            ...(patch.paymentMethodId !== undefined ? { paymentMethodId: patch.paymentMethodId || null } : {}),
            ...(paymentDate ? { paymentDate } : {}),
          },
        });
      }
    }
    // Always recomputed from the authoritative payment sum, never trusted
    // from the client — the cache stays self-healing.
    const sum = await tx.payment.aggregate({ where: { transactionId: id }, _sum: { amount: true } });
    const effectivePaid = sum._sum.amount ?? new Decimal(0);

    const updated = await tx.financialTransaction.update({
      where: { id },
      data: {
        ...data,
        paidAmount: effectivePaid,
        status: calculateStatus(amount, effectivePaid),
        updatedBy: { connect: { id: actor.id } },
      },
    });

    await writeAuditEvent(tx, {
      entityType: "FinancialTransaction",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after: { amount: updated.originalAmount.toString(), paid: updated.paidAmount.toString(), status: updated.status },
      metadata: { via: "monthly-sheet", fields: Object.keys(patch) },
    });

    return updated;
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "INVALID_PAYMENT_DATE") return null;
    throw err;
  });

  if (!result) return actionError("Enter the date as YYYY-MM-DD");

  return actionSuccess({
    amount: result.originalAmount.toString(),
    paidAmount: result.paidAmount.toString(),
    status: result.status,
  });
}

export async function createLedgerRow(
  entityCode: string,
  transactionType: "INFLOW" | "OUTFLOW",
  periodKey: string,
  patch: LedgerRowPatch
): Promise<ActionResult<{ id: string }>> {
  const period = parsePeriodKey(periodKey);
  if (!period) return actionError("Pick a valid month");

  const entity = await prisma.businessEntity.findUnique({ where: { code: entityCode.toUpperCase() } });
  if (!entity) return actionError("Entity not found");
  const actor = await requireEntityWrite(entity.code);

  const description = (patch.description ?? "").trim();
  if (!description) {
    return actionError(transactionType === "INFLOW" ? "Service / Project is required" : "Expense item is required");
  }

  // Default to the 1st of the month being edited, then clamp anything typed
  // to inside that month — a row dated outside the sheet it lives on would
  // silently disappear from it.
  let date = periodFirstDay(period);
  if (patch.transactionDate) {
    const parsed = parseDateOnly(patch.transactionDate);
    if (!parsed) return actionError("Enter the date as YYYY-MM-DD");
    const range = periodRange(period);
    if (parsed < range.from || parsed > range.to) {
      return actionError("That date is outside this month");
    }
    date = parsed;
  }

  const amount = toDecimal(patch.amount ?? "0");
  if (!amount || amount.lt(0)) return actionError("Enter a valid amount");
  const paidInput = toDecimal(patch.paidAmount ?? "0");
  if (!paidInput || paidInput.lt(0)) return actionError("Enter a valid paid amount");
  if (paidInput.gt(amount)) return actionError("Paid can't exceed the amount due");

  const created = await prisma.$transaction(async (tx) => {
    let clientId = patch.clientId ?? undefined;
    // Inflow rows are keyed by client; typing a new name creates it rather
    // than forcing a detour into master data mid-entry.
    if (transactionType === "INFLOW" && !clientId && patch.clientName?.trim()) {
      const name = patch.clientName.trim().slice(0, 200);
      const client = await tx.client.upsert({
        where: { entityId_name: { entityId: entity.id, name } },
        update: {},
        create: { entityId: entity.id, name },
      });
      clientId = client.id;
    }

    const txn = await tx.financialTransaction.create({
      data: {
        entityId: entity.id,
        transactionType,
        transactionDate: date,
        originalAmount: amount,
        originalCurrency: entity.baseCurrency,
        description: description.slice(0, 300),
        categoryId: patch.categoryId || undefined,
        expenseTypeId: patch.expenseTypeId || undefined,
        departmentId: patch.departmentId || undefined,
        clientId,
        closedByName: patch.closedByName?.trim() || undefined,
        referenceNumber: patch.referenceNumber?.trim() || undefined,
        remarks: patch.remarks?.trim() || undefined,
        paidAmount: new Decimal(0),
        status: "PENDING",
        createdById: actor.id,
      },
    });

    if (paidInput.gt(0)) {
      await tx.payment.create({
        data: {
          transactionId: txn.id,
          amount: paidInput,
          currency: entity.baseCurrency,
          paymentDate: date,
          createdById: actor.id,
        },
      });
      await tx.financialTransaction.update({
        where: { id: txn.id },
        data: { paidAmount: paidInput, status: calculateStatus(amount, paidInput) },
      });
    }

    await writeAuditEvent(tx, {
      entityType: "FinancialTransaction",
      entityId: txn.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { amount: amount.toString(), paid: paidInput.toString() },
      metadata: { via: "monthly-sheet" },
    });

    return txn;
  });

  revalidatePath(`/operations/${entityCode}/${transactionType === "INFLOW" ? "inflow" : "outflow"}/${periodKey}`);
  return actionSuccess({ id: created.id });
}

export async function deleteLedgerRow(id: string): Promise<ActionResult> {
  const row = await loadWritableRow(id);
  if (!row) return actionError("That row no longer exists — refresh the sheet.");
  const actor = await requireEntityWrite(row.entity.code);

  await prisma.$transaction(async (tx) => {
    await writeAuditEvent(tx, {
      entityType: "FinancialTransaction",
      entityId: id,
      action: "DELETE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: {
        description: row.description,
        amount: row.originalAmount.toString(),
        paid: row.paidAmount.toString(),
      },
      metadata: { via: "monthly-sheet" },
    });
    // Payments cascade with the transaction (see the Payment relation).
    await tx.financialTransaction.delete({ where: { id } });
  });

  return actionSuccess(undefined);
}
