"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserManagementAccess, ForbiddenError } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { createUserSchema, setUserRoleSchema } from "@/validators/user";

const BCRYPT_ROUNDS = 12;

/** Never let the last active SUPER_ADMIN be demoted or deactivated — that would lock everyone out of user management. */
async function assertNotLastSuperAdmin(userId: string) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role !== "SUPER_ADMIN") return;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, id: { not: userId } },
  });
  if (otherActiveAdmins === 0) {
    throw new ForbiddenError("Cannot change this account — it is the last active Super Admin.");
  }
}

export async function createUser(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireUserManagementAccess();

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return actionError("A user with this email already exists", { email: ["A user with this email already exists"] });

  const passwordHash = await bcrypt.hash(parsed.data.temporaryPassword, BCRYPT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id,
      action: "USER_CREATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { email: user.email, name: user.name, role: user.role },
    });
    return user;
  });

  revalidatePath("/operations/users");
  return actionSuccess({ id: result.id });
}

export async function setUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireUserManagementAccess();
  if (actor.id === id) return actionError("You cannot deactivate your own account.");
  if (!isActive) await assertNotLastSuperAdmin(id);

  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id } });
    const after = await tx.user.update({ where: { id }, data: { isActive } });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: id,
      action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: { isActive: before.isActive },
      after: { isActive: after.isActive },
    });
  });

  revalidatePath("/operations/users");
  return actionSuccess(undefined);
}

export async function setUserRole(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = setUserRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await requireUserManagementAccess();
  if (actor.id === id) return actionError("You cannot change your own role.");
  if (parsed.data.role !== "SUPER_ADMIN") await assertNotLastSuperAdmin(id);

  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id } });
    const after = await tx.user.update({ where: { id }, data: { role: parsed.data.role } });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: id,
      action: "USER_UPDATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: { role: before.role },
      after: { role: after.role },
    });
  });

  revalidatePath("/operations/users");
  return actionSuccess(undefined);
}

export async function resetUserPassword(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = createUserSchema.shape.temporaryPassword.safeParse(formData.get("temporaryPassword"));
  if (!parsed.success) return actionError("Invalid input", { temporaryPassword: parsed.error.issues.map((i) => i.message) });

  const actor = await requireUserManagementAccess();
  const passwordHash = await bcrypt.hash(parsed.data, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: id,
      action: "PASSWORD_CHANGED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      metadata: { resetByAdmin: true },
    });
  });

  revalidatePath("/operations/users");
  return actionSuccess(undefined);
}
