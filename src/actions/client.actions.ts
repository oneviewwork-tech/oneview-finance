"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { clientSchema } from "@/validators/finance";

export async function createClient(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse({
    entityId: formData.get("entityId"),
    name: formData.get("name"),
    clientTypeId: formData.get("clientTypeId"),
    country: formData.get("country") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const existing = await prisma.client.findUnique({
    where: { entityId_name: { entityId: parsed.data.entityId, name: parsed.data.name } },
  });
  if (existing) return actionError("A client with this name already exists for this entity");

  const actor = await getCurrentUser();
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
    return client;
  });

  revalidatePath("/operations/clients");
  return actionSuccess({ id: result.id });
}

export async function setClientStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  const actor = await getCurrentUser();
  await prisma.$transaction(async (tx) => {
    const before = await tx.client.findUniqueOrThrow({ where: { id } });
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
