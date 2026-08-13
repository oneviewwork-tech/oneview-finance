"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/date";
import { requireEntityWrite } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { clientSchema } from "@/validators/finance";

const { Decimal } = Prisma;

export async function createClient(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse({
    entityId: formData.get("entityId"),
    name: formData.get("name"),
    clientTypeId: formData.get("clientTypeId"),
    country: formData.get("country") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    dealDate: formData.get("dealDate"),
    dealValue: formData.get("dealValue") || undefined,
    taxAmount: formData.get("taxAmount") || undefined,
    serviceProject: formData.get("serviceProject") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const entity = await prisma.businessEntity.findUnique({ where: { id: parsed.data.entityId } });
  if (!entity) return actionError("Entity not found");
  const actor = await requireEntityWrite(entity.code);

  const existing = await prisma.client.findUnique({
    where: { entityId_name: { entityId: parsed.data.entityId, name: parsed.data.name } },
  });
  if (existing) return actionError("A client with this name already exists for this entity");

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        entityId: parsed.data.entityId,
        name: parsed.data.name,
        clientTypeId: parsed.data.clientTypeId,
        country: parsed.data.country,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail || undefined,
        contactPhone: parsed.data.contactPhone,
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

    // The opening deal, if one was entered. Booked as a normal inflow row so
    // it behaves like every other deal from here on — it appears in the
    // month's sheet, its dashboard and its exports, rather than being a
    // special case attached to the client record.
    if (parsed.data.dealValue) {
      const netValue = new Decimal(parsed.data.dealValue);
      const taxAmount = parsed.data.taxAmount ? new Decimal(parsed.data.taxAmount) : new Decimal(0);
      // Gross, matching the inflow form: originalAmount is what the client
      // owes and what payments settle against.
      const gross = netValue.plus(taxAmount);
      const dealDate = parsed.data.dealDate ? parseDateOnly(parsed.data.dealDate) : new Date();

      const txn = await tx.financialTransaction.create({
        data: {
          entityId: parsed.data.entityId,
          transactionType: "INFLOW",
          transactionDate: dealDate,
          originalAmount: gross,
          taxAmount,
          originalCurrency: entity.baseCurrency,
          clientId: client.id,
          description: parsed.data.serviceProject?.trim() || "Opening deal",
          paidAmount: new Decimal(0),
          status: "PENDING",
          createdById: actor.id,
        },
      });
      await writeAuditEvent(tx, {
        entityType: "FinancialTransaction",
        entityId: txn.id,
        action: "CREATE",
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: { amount: gross.toString(), tax: taxAmount.toString() },
        metadata: { via: "client-creation", clientId: client.id },
      });
    }

    return client;
  });

  revalidatePath("/operations/clients");
  return actionSuccess({ id: result.id });
}

export async function setClientStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  const before = await prisma.client.findUniqueOrThrow({ where: { id }, include: { entity: true } });
  const actor = await requireEntityWrite(before.entity.code);

  await prisma.$transaction(async (tx) => {
    const after = await tx.client.update({ where: { id }, data: { status } });
    await writeAuditEvent(tx, {
      entityType: "Client",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/clients");
  return actionSuccess(undefined);
}
