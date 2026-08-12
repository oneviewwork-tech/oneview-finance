"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { signOut } from "@/lib/auth";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { changePasswordSchema } from "@/validators/auth";

const BCRYPT_ROUNDS = 12;

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return actionError("Current password is incorrect", { currentPassword: ["Current password is incorrect"] });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });
  await writeAuditEvent(prisma, {
    entityType: "User",
    entityId: user.id,
    action: "PASSWORD_CHANGED",
    actorUserId: user.id,
    actorEmail: user.email,
  });

  // The JWT still carries the old mustChangePassword claim and can't be
  // patched in place — sign out and require a fresh login with the new
  // password rather than juggling a same-session token refresh.
  await signOut({ redirectTo: "/login" });
  return actionSuccess(undefined);
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
