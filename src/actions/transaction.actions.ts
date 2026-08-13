"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEntityWrite } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { parseDateOnly } from "@/lib/date";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import {
  createInflowSchema,
  createOutflowSchema,
  recordPaymentSchema,
  reversePaymentSchema,
} from "@/validators/finance";
import { computeTransactionAggregate, wouldOverpay } from "@/domain/finance/calculations";

const { Decimal } = Prisma;

export async function createInflow(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = createInflowSchema.safeParse({
    entityId: formData.get("entityId"),
    transactionDate: formData.get("transactionDate"),
    clientId: formData.get("clientId"),
    newClientName: formData.get("newClientName") || undefined,
    newClientTypeId: formData.get("newClientTypeId"),
    description: formData.get("description"),
    departmentId: formData.get("departmentId"),
    dealValue: formData.get("dealValue"),
    taxAmount: formData.get("taxAmount") || undefined,
    amountReceived: formData.get("amountReceived") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    closedByName: formData.get("closedByName") || undefined,
    remarks: formData.get("remarks") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));
  const input = parsed.data;

  if (!input.clientId && !input.newClientName) {
    return actionError("Select an existing client or enter a new client name", {
      clientId: ["Select an existing client or enter a new client name"],
    });
  }

  const entity = await prisma.businessEntity.findUnique({ where: { id: input.entityId } });
  if (!entity) return actionError("Entity not found");

  const actor = await requireEntityWrite(entity.code);

  // The row's amount is the gross: value plus tax. Everything downstream —
  // receivables, dashboards, exports — sums originalAmount, so it has to be
  // the figure actually owed, not the pre-tax one.
  const netValue = new Decimal(input.dealValue);
  const taxAmount = input.taxAmount ? new Decimal(input.taxAmount) : new Decimal(0);
  const dealValue = netValue.plus(taxAmount);
  const amountReceived = input.amountReceived ? new Decimal(input.amountReceived) : new Decimal(0);
  if (wouldOverpay(dealValue, new Decimal(0), amountReceived)) {
    return actionError("Amount received cannot exceed the deal value", {
      amountReceived: ["Amount received cannot exceed the deal value"],
    });
  }

  const transactionDate = parseDateOnly(input.transactionDate);
  const aggregate = computeTransactionAggregate(dealValue, amountReceived.gt(0) ? [amountReceived] : []);

  const result = await prisma.$transaction(async (tx) => {
    let clientId = input.clientId;
    if (!clientId && input.newClientName) {
      const client = await tx.client.create({
        data: {
          entityId: input.entityId,
          name: input.newClientName,
          clientTypeId: input.newClientTypeId,
        },
      });
      await writeAuditEvent(tx, {
        entityType: "Client",
        entityId: client.id,
        action: "CREATE",
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: client,
      });
      clientId = client.id;
    }

    const txnRecord = await tx.financialTransaction.create({
      data: {
        entityId: input.entityId,
        transactionType: "INFLOW",
        transactionDate,
        originalAmount: dealValue,
        taxAmount,
        originalCurrency: entity.baseCurrency,
        clientId,
        departmentId: input.departmentId,
        description: input.description,
        closedByName: input.closedByName,
        referenceNumber: input.referenceNumber,
        remarks: input.remarks,
        paidAmount: aggregate.paidAmount,
        status: aggregate.status,
        createdById: actor.id,
      },
    });

    await writeAuditEvent(tx, {
      entityType: "FinancialTransaction",
      entityId: txnRecord.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { ...txnRecord, originalAmount: txnRecord.originalAmount.toString() },
    });

    if (amountReceived.gt(0)) {
      const payment = await tx.payment.create({
        data: {
          transactionId: txnRecord.id,
          amount: amountReceived,
          currency: entity.baseCurrency,
          paymentDate: transactionDate,
          paymentMethodId: input.paymentMethodId,
          referenceNumber: input.referenceNumber,
          createdById: actor.id,
        },
      });
      await writeAuditEvent(tx, {
        entityType: "Payment",
        entityId: payment.id,
        action: "PAYMENT_RECORDED",
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: { ...payment, amount: payment.amount.toString() },
        metadata: { transactionId: txnRecord.id },
      });
    }

    return txnRecord;
  });

  revalidatePath("/operations/inflow");
  return actionSuccess({ id: result.id });
}

export async function createOutflow(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = createOutflowSchema.safeParse({
    entityId: formData.get("entityId"),
    transactionDate: formData.get("transactionDate"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    expenseTypeId: formData.get("expenseTypeId"),
    vendorId: formData.get("vendorId"),
    departmentId: formData.get("departmentId"),
    amountDue: formData.get("amountDue"),
    payFull: formData.get("payFull") || "N",
    amountPaid: formData.get("amountPaid") || undefined,
    paymentDate: formData.get("paymentDate") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    remarks: formData.get("remarks") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));
  const input = parsed.data;

  const entity = await prisma.businessEntity.findUnique({ where: { id: input.entityId } });
  if (!entity) return actionError("Entity not found");

  const actor = await requireEntityWrite(entity.code);

  const amountDue = new Decimal(input.amountDue);
  // Mirrors the workbook's I9 formula exactly: Pay Full "Y" -> paid = amountDue,
  // else the typed partial amount (or 0 if nothing typed = still pending).
  const paidNow =
    input.payFull === "Y" ? amountDue : input.amountPaid ? new Decimal(input.amountPaid) : new Decimal(0);
  if (wouldOverpay(amountDue, new Decimal(0), paidNow)) {
    return actionError("Amount paid cannot exceed the amount due", {
      amountPaid: ["Amount paid cannot exceed the amount due"],
    });
  }

  const transactionDate = parseDateOnly(input.transactionDate);
  const paymentDate = input.paymentDate ? parseDateOnly(input.paymentDate) : transactionDate;
  const aggregate = computeTransactionAggregate(amountDue, paidNow.gt(0) ? [paidNow] : []);

  const result = await prisma.$transaction(async (tx) => {
    const txnRecord = await tx.financialTransaction.create({
      data: {
        entityId: input.entityId,
        transactionType: "OUTFLOW",
        transactionDate,
        originalAmount: amountDue,
        originalCurrency: entity.baseCurrency,
        categoryId: input.categoryId,
        expenseTypeId: input.expenseTypeId,
        vendorId: input.vendorId,
        departmentId: input.departmentId,
        description: input.description,
        referenceNumber: input.referenceNumber,
        remarks: input.remarks,
        paidAmount: aggregate.paidAmount,
        status: aggregate.status,
        createdById: actor.id,
      },
    });

    await writeAuditEvent(tx, {
      entityType: "FinancialTransaction",
      entityId: txnRecord.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { ...txnRecord, originalAmount: txnRecord.originalAmount.toString() },
    });

    if (paidNow.gt(0)) {
      const payment = await tx.payment.create({
        data: {
          transactionId: txnRecord.id,
          amount: paidNow,
          currency: entity.baseCurrency,
          paymentDate,
          paymentMethodId: input.paymentMethodId,
          referenceNumber: input.referenceNumber,
          createdById: actor.id,
        },
      });
      await writeAuditEvent(tx, {
        entityType: "Payment",
        entityId: payment.id,
        action: "PAYMENT_RECORDED",
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: { ...payment, amount: payment.amount.toString() },
        metadata: { transactionId: txnRecord.id },
      });
    }

    return txnRecord;
  });

  revalidatePath("/operations/outflow");
  return actionSuccess({ id: result.id });
}

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const parsed = recordPaymentSchema.safeParse({
    transactionId: formData.get("transactionId"),
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    paymentMethodId: formData.get("paymentMethodId"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));
  const input = parsed.data;

  const txnRecord = await prisma.financialTransaction.findUnique({
    where: { id: input.transactionId },
    include: { entity: true },
  });
  if (!txnRecord) return actionError("Transaction not found");

  const actor = await requireEntityWrite(txnRecord.entity.code);

  const amount = new Decimal(input.amount);
  if (wouldOverpay(txnRecord.originalAmount, txnRecord.paidAmount, amount)) {
    return actionError("This payment would exceed the remaining balance", {
      amount: ["This payment would exceed the remaining balance"],
    });
  }

  const beforeStatus = txnRecord.status;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        transactionId: txnRecord.id,
        amount,
        currency: txnRecord.originalCurrency,
        paymentDate: parseDateOnly(input.paymentDate),
        paymentMethodId: input.paymentMethodId,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        createdById: actor.id,
      },
    });

    // Recompute from the authoritative SUM of all payments, not the cached
    // paidAmount + this delta — keeps the cache self-healing even if it
    // ever drifted from the underlying ledger.
    const sum = await tx.payment.aggregate({
      where: { transactionId: txnRecord.id },
      _sum: { amount: true },
    });
    const paidAmount = sum._sum.amount ?? new Decimal(0);
    const aggregate = computeTransactionAggregate(txnRecord.originalAmount, [paidAmount]);

    await tx.financialTransaction.update({
      where: { id: txnRecord.id },
      data: { paidAmount: aggregate.paidAmount, status: aggregate.status, updatedById: actor.id },
    });

    await writeAuditEvent(tx, {
      entityType: "Payment",
      entityId: payment.id,
      action: "PAYMENT_RECORDED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { ...payment, amount: payment.amount.toString() },
      metadata: {
        transactionId: txnRecord.id,
        statusBefore: beforeStatus,
        statusAfter: aggregate.status,
      },
    });
  });

  revalidatePath(`/operations/transactions/${txnRecord.id}`);
  revalidatePath(txnRecord.transactionType === "INFLOW" ? "/operations/inflow" : "/operations/outflow");
  return actionSuccess(undefined);
}

export async function reversePayment(formData: FormData): Promise<ActionResult> {
  const parsed = reversePaymentSchema.safeParse({ paymentId: formData.get("paymentId") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    include: { transaction: { include: { entity: true } } },
  });
  if (!payment) return actionError("Payment not found");

  const { transaction: txnRecord } = payment;
  const actor = await requireEntityWrite(txnRecord.entity.code);
  const beforeStatus = txnRecord.status;

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });

    const sum = await tx.payment.aggregate({
      where: { transactionId: txnRecord.id },
      _sum: { amount: true },
    });
    const paidAmount = sum._sum.amount ?? new Decimal(0);
    const aggregate = computeTransactionAggregate(txnRecord.originalAmount, [paidAmount]);

    await tx.financialTransaction.update({
      where: { id: txnRecord.id },
      data: { paidAmount: aggregate.paidAmount, status: aggregate.status, updatedById: actor.id },
    });

    await writeAuditEvent(tx, {
      entityType: "Payment",
      entityId: payment.id,
      action: "PAYMENT_REVERSED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: { ...payment, amount: payment.amount.toString() },
      metadata: {
        transactionId: txnRecord.id,
        statusBefore: beforeStatus,
        statusAfter: aggregate.status,
      },
    });
  });

  revalidatePath(`/operations/transactions/${txnRecord.id}`);
  revalidatePath(txnRecord.transactionType === "INFLOW" ? "/operations/inflow" : "/operations/outflow");
  return actionSuccess(undefined);
}
