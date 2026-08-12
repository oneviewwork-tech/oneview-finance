"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataAccess } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { masterDataNameSchema } from "@/validators/finance";

// Categories, expense types, payment methods and client types all share the
// same tiny shape (name/isActive/sortOrder) and the same lifecycle rule:
// deactivate, never hard-delete, because historical transactions reference
// them by id and must keep reading correctly forever. Four short, explicit
// functions per model reads more clearly here than one generic delegate
// abstraction would for something this small.

async function nextSortOrder(count: () => Promise<number>) {
  return count();
}

export async function createCategory(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = masterDataNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireMasterDataAccess();
  const sortOrder = await nextSortOrder(() => prisma.financialCategory.count());

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.financialCategory.create({
      data: { name: parsed.data.name, sortOrder },
    });
    await writeAuditEvent(tx, {
      entityType: "FinancialCategory",
      entityId: category.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: category,
    });
    return category;
  });

  revalidatePath("/operations/categories");
  return actionSuccess({ id: result.id });
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireMasterDataAccess();
  await prisma.$transaction(async (tx) => {
    const before = await tx.financialCategory.findUniqueOrThrow({ where: { id } });
    const after = await tx.financialCategory.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "FinancialCategory",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/categories");
  return actionSuccess(undefined);
}

export async function createExpenseType(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = masterDataNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireMasterDataAccess();
  const sortOrder = await nextSortOrder(() => prisma.expenseType.count());

  const result = await prisma.$transaction(async (tx) => {
    const expenseType = await tx.expenseType.create({ data: { name: parsed.data.name, sortOrder } });
    await writeAuditEvent(tx, {
      entityType: "ExpenseType",
      entityId: expenseType.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: expenseType,
    });
    return expenseType;
  });

  revalidatePath("/operations/categories");
  return actionSuccess({ id: result.id });
}

export async function setExpenseTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireMasterDataAccess();
  await prisma.$transaction(async (tx) => {
    const before = await tx.expenseType.findUniqueOrThrow({ where: { id } });
    const after = await tx.expenseType.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "ExpenseType",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/categories");
  return actionSuccess(undefined);
}

export async function createPaymentMethod(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = masterDataNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireMasterDataAccess();
  const sortOrder = await nextSortOrder(() => prisma.paymentMethod.count());

  const result = await prisma.$transaction(async (tx) => {
    const method = await tx.paymentMethod.create({ data: { name: parsed.data.name, sortOrder } });
    await writeAuditEvent(tx, {
      entityType: "PaymentMethod",
      entityId: method.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: method,
    });
    return method;
  });

  revalidatePath("/operations/categories");
  return actionSuccess({ id: result.id });
}

export async function setPaymentMethodActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireMasterDataAccess();
  await prisma.$transaction(async (tx) => {
    const before = await tx.paymentMethod.findUniqueOrThrow({ where: { id } });
    const after = await tx.paymentMethod.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "PaymentMethod",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/categories");
  return actionSuccess(undefined);
}

export async function createClientType(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = masterDataNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireMasterDataAccess();
  const sortOrder = await nextSortOrder(() => prisma.clientType.count());

  const result = await prisma.$transaction(async (tx) => {
    const clientType = await tx.clientType.create({ data: { name: parsed.data.name, sortOrder } });
    await writeAuditEvent(tx, {
      entityType: "ClientType",
      entityId: clientType.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: clientType,
    });
    return clientType;
  });

  revalidatePath("/operations/categories");
  return actionSuccess({ id: result.id });
}

export async function setClientTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireMasterDataAccess();
  await prisma.$transaction(async (tx) => {
    const before = await tx.clientType.findUniqueOrThrow({ where: { id } });
    const after = await tx.clientType.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "ClientType",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/categories");
  return actionSuccess(undefined);
}

export async function createDepartment(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = masterDataNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireMasterDataAccess();
  const sortOrder = await nextSortOrder(() => prisma.department.count());

  const result = await prisma.$transaction(async (tx) => {
    const department = await tx.department.create({ data: { name: parsed.data.name, sortOrder } });
    await writeAuditEvent(tx, {
      entityType: "Department",
      entityId: department.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: department,
    });
    return department;
  });

  revalidatePath("/operations/categories");
  return actionSuccess({ id: result.id });
}

export async function setDepartmentActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireMasterDataAccess();
  await prisma.$transaction(async (tx) => {
    const before = await tx.department.findUniqueOrThrow({ where: { id } });
    const after = await tx.department.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "Department",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/categories");
  return actionSuccess(undefined);
}
