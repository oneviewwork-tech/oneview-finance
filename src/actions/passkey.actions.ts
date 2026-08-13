"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireUserManagementAccess } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-result";
import { PASSKEY_COOKIE, signStepUpToken } from "@/lib/passkey-token";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { setPasskeySchema, passkeySchema } from "@/validators/auth";
import {
  generateOtp,
  isWellFormedOtp,
  otpExpiry,
  otpStateRejection,
  otpTtlMinutes,
  OTP_MAX_ATTEMPTS,
} from "@/domain/auth/otp";

const BCRYPT_ROUNDS = 12;

// Mirrors the password lockout in auth.ts: five wrong passkeys locks the
// second factor for fifteen minutes. Deliberately a separate counter — a
// passkey attacker shouldn't be able to lock someone out of login, and vice
// versa.
const PASSKEY_LOCKOUT_THRESHOLD = 5;
const PASSKEY_LOCKOUT_MS = 15 * 60 * 1000;

/** How long a cleared gate stays cleared — the life of the login session. */
const STEP_UP_TTL_MS = 8 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  // Without this the proof would be signed with a guessable key, which is
  // worse than no gate at all — fail loudly rather than issue a weak token.
  if (!s) throw new Error("AUTH_SECRET is required to issue passkey proofs");
  return s;
}

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

async function grantStepUp(userId: string, sessionId: string | undefined): Promise<void> {
  // No session id means no way to bind the proof to this login, so it would
  // outlive the session it was granted for. Refuse rather than issue it.
  if (!sessionId) throw new Error("Cannot issue a passkey proof without a session id");
  const token = await signStepUpToken(
    { uid: userId, sid: sessionId, exp: Date.now() + STEP_UP_TTL_MS },
    secret()
  );
  const jar = await cookies();
  jar.set(PASSKEY_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(STEP_UP_TTL_MS / 1000),
  });
}

/** Called on sign-out so the proof doesn't linger for the next session. */
export async function clearStepUp(): Promise<void> {
  const jar = await cookies();
  jar.delete(PASSKEY_COOKIE);
}

/**
 * Admin recovery: wipe another user's passkey so they can set a new one.
 *
 * The emailed reset is the normal path, but it only works when mail can
 * actually reach the person — on Resend's shared onboarding domain, only
 * the Resend account owner's address receives anything, which would leave
 * every other user with no way back. This is that way back.
 *
 * Not available for your own account: the point of a second factor is that
 * possessing the first one can't remove it. Clearing your own would make it
 * exactly that. Use the emailed reset, or another admin.
 */
export async function clearUserPasskey(id: string): Promise<ActionResult> {
  const actor = await requireUserManagementAccess();

  if (id === actor.id) {
    return actionError("You can't clear your own passkey. Use “Forgot passkey”, or ask another administrator.");
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, passkeyHash: true } });
  if (!target) return actionError("User not found");
  if (!target.passkeyHash) return actionError("That user doesn't have a passkey set");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passkeyHash: null, passkeySetAt: null, passkeyFailedAttempts: 0, passkeyLockedUntil: null },
    });
    // Outstanding codes reset the passkey that no longer exists.
    await tx.passkeyResetToken.updateMany({
      where: { userId: id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: id,
      action: "PASSKEY_CLEARED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      metadata: { targetEmail: target.email },
    });
  });

  revalidatePath("/operations/users");
  return actionSuccess(undefined);
}

// ── Set (first time, or after a reset) ───────────────────────────────────

export async function setPasskey(formData: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user?.id) return actionError("Your session has expired. Sign in again.");

  const parsed = setPasskeySchema.safeParse({
    passkey: formData.get("passkey"),
    confirmPasskey: formData.get("confirmPasskey"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return actionError(parsed.error.issues[0].message, fieldErrors);
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return actionError("Your session has expired. Sign in again.");

  // A passkey equal to the password is a second lock keyed the same as the
  // first — it adds a prompt and no security.
  if (await bcrypt.compare(parsed.data.passkey, record.passwordHash)) {
    return actionError("Your passkey must be different from your password", {
      passkey: ["Your passkey must be different from your password"],
    });
  }

  const passkeyHash = await bcrypt.hash(parsed.data.passkey, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passkeyHash, passkeySetAt: new Date(), passkeyFailedAttempts: 0, passkeyLockedUntil: null },
    });
    // Any outstanding reset codes are spent — the passkey they would have
    // reset no longer exists.
    await tx.passkeyResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id!,
      action: "PASSKEY_SET",
      actorUserId: user.id!,
      actorEmail: user.email ?? null,
    });
  });

  // Setting it counts as proving it — the user just typed it twice.
  await grantStepUp(user.id, user.sessionId);
  return actionSuccess(undefined);
}

// ── Verify (the gate itself) ─────────────────────────────────────────────

export async function verifyPasskey(formData: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user?.id) return actionError("Your session has expired. Sign in again.");

  const parsed = passkeySchema.safeParse(formData.get("passkey"));
  // A malformed entry is just a wrong passkey — don't explain the format,
  // that only helps someone guessing.
  if (!parsed.success) return actionError("Incorrect passkey");

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record?.passkeyHash) return actionError("No passkey is set for this account");

  if (record.passkeyLockedUntil && record.passkeyLockedUntil > new Date()) {
    const mins = Math.ceil((record.passkeyLockedUntil.getTime() - Date.now()) / 60000);
    return actionError(`Too many incorrect attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  const valid = await bcrypt.compare(parsed.data, record.passkeyHash);
  if (!valid) {
    const attempts = record.passkeyFailedAttempts + 1;
    const lockingNow = attempts >= PASSKEY_LOCKOUT_THRESHOLD;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passkeyFailedAttempts: attempts,
        passkeyLockedUntil: lockingNow ? new Date(Date.now() + PASSKEY_LOCKOUT_MS) : record.passkeyLockedUntil,
      },
    });
    await writeAuditEvent(prisma, {
      entityType: "User",
      entityId: user.id,
      action: lockingNow ? "PASSKEY_LOCKED" : "PASSKEY_FAILED",
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      metadata: { attempts },
    });
    if (lockingNow) {
      return actionError("Too many incorrect attempts. Try again in 15 minutes.");
    }
    const left = PASSKEY_LOCKOUT_THRESHOLD - attempts;
    return actionError(`Incorrect passkey. ${left} attempt${left === 1 ? "" : "s"} remaining.`);
  }

  if (record.passkeyFailedAttempts > 0 || record.passkeyLockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passkeyFailedAttempts: 0, passkeyLockedUntil: null },
    });
  }
  await writeAuditEvent(prisma, {
    entityType: "User",
    entityId: user.id,
    action: "PASSKEY_VERIFIED",
    actorUserId: user.id,
    actorEmail: user.email ?? null,
  });

  await grantStepUp(user.id, user.sessionId);
  return actionSuccess(undefined);
}

// ── Forgot: request a code ───────────────────────────────────────────────

export async function requestPasskeyReset(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user?.id || !user.email) return actionError("Your session has expired. Sign in again.");

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // One live code at a time: requesting a new one must invalidate the old,
    // or every request would widen the window for guessing.
    await tx.passkeyResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.passkeyResetToken.create({
      data: { userId: user.id!, codeHash, expiresAt: otpExpiry() },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id!,
      action: "PASSKEY_RESET_REQUESTED",
      actorUserId: user.id!,
      actorEmail: user.email ?? null,
    });
  });

  try {
    await sendEmail({
      to: user.email,
      // The code is deliberately NOT in the subject. A subject line renders
      // on a locked phone and in inbox previews, so putting it there would
      // hand the second factor to anyone who can see the screen — which is
      // most of what this factor exists to prevent.
      subject: "ONEVIEW Finance — passkey reset requested",
      text: [
        `Your passkey reset code is ${code}.`,
        ``,
        `It expires in ${otpTtlMinutes()} minutes and can be used once.`,
        ``,
        `If you didn't ask to reset your passkey, someone may know your password —`,
        `change it immediately and tell your administrator.`,
      ].join("\n"),
    });
  } catch (err) {
    // The code exists but never reached anyone. Say so rather than showing
    // "check your email" for a mail that will never arrive.
    console.error("passkey reset email failed", err);
    if (err instanceof EmailNotConfiguredError) {
      return actionError("Email isn't configured on the server, so the code couldn't be sent. Contact your administrator.");
    }
    return actionError("We couldn't send the code. Try again, or contact your administrator.");
  }

  return actionSuccess(undefined);
}

// ── Forgot: confirm the code and set a new passkey ───────────────────────

export async function confirmPasskeyReset(formData: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user?.id) return actionError("Your session has expired. Sign in again.");

  const code = String(formData.get("code") ?? "").trim();
  const parsed = setPasskeySchema.safeParse({
    passkey: formData.get("passkey"),
    confirmPasskey: formData.get("confirmPasskey"),
  });

  if (!isWellFormedOtp(code)) {
    return actionError("Enter the 6-digit code from your email", { code: ["Enter the 6-digit code from your email"] });
  }
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return actionError(parsed.error.issues[0].message, fieldErrors);
  }

  const token = await prisma.passkeyResetToken.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return actionError("No reset is in progress. Request a new code.");

  const rejection = otpStateRejection(token);
  if (rejection === "expired") return actionError("That code has expired. Request a new one.");
  if (rejection === "consumed") return actionError("That code has already been used. Request a new one.");
  if (rejection === "too_many_attempts") {
    return actionError("Too many incorrect codes. Request a new one.");
  }

  const matches = await bcrypt.compare(code, token.codeHash);
  if (!matches) {
    const attempts = token.attempts + 1;
    await prisma.passkeyResetToken.update({ where: { id: token.id }, data: { attempts } });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return actionError(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
        : "Too many incorrect codes. Request a new one.",
      { code: ["Incorrect code"] }
    );
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return actionError("Your session has expired. Sign in again.");
  if (await bcrypt.compare(parsed.data.passkey, record.passwordHash)) {
    return actionError("Your passkey must be different from your password", {
      passkey: ["Your passkey must be different from your password"],
    });
  }

  const passkeyHash = await bcrypt.hash(parsed.data.passkey, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    // Consume inside the same transaction as the update, so a crash can't
    // leave a spent code usable or a used code unspent.
    await tx.passkeyResetToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    await tx.user.update({
      where: { id: user.id },
      data: { passkeyHash, passkeySetAt: new Date(), passkeyFailedAttempts: 0, passkeyLockedUntil: null },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id!,
      action: "PASSKEY_RESET_COMPLETED",
      actorUserId: user.id!,
      actorEmail: user.email ?? null,
    });
  });

  await grantStepUp(user.id, user.sessionId);
  return actionSuccess(undefined);
}
