"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEntityWrite } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { vendorSchema } from "@/validators/finance";

export async function createVendor(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = vendorSchema.safeParse({
    entityId: formData.get("entityId"),
    name: formData.get("name"),
    country: formData.get("country") || undefined,
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const entity = await prisma.businessEntity.findUnique({ where: { id: parsed.data.entityId } });
  if (!entity) return actionError("Entity not found");
  const actor = await requireEntityWrite(entity.code);

  const existing = await prisma.vendor.findUnique({
    where: { entityId_name: { entityId: parsed.data.entityId, name: parsed.data.name } },
  });
  if (existing) return actionError("A vendor with this name already exists for this entity");

  const result = await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        entityId: parsed.data.entityId,
        name: parsed.data.name,
        country: parsed.data.country,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "Vendor",
      entityId: vendor.id,
      action: "CREATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: vendor,
    });
    return vendor;
  });

  revalidatePath("/operations/vendors");
  return actionSuccess({ id: result.id });
}

export async function setVendorStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  const before = await prisma.vendor.findUniqueOrThrow({ where: { id }, include: { entity: true } });
  const actor = await requireEntityWrite(before.entity.code);

  await prisma.$transaction(async (tx) => {
    const after = await tx.vendor.update({ where: { id }, data: { status } });
    await writeAuditEvent(tx, {
      entityType: "Vendor",
      entityId: id,
      action: "UPDATE",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before,
      after,
    });
  });
  revalidatePath("/operations/vendors");
  return actionSuccess(undefined);
}
