"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/client-ip";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-result";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { resetPasswordSchema } from "@/validators/auth";
import {
  generateOtp,
  isWellFormedOtp,
  otpExpiry,
  otpStateRejection,
  otpTtlMinutes,
  OTP_MAX_ATTEMPTS,
} from "@/domain/auth/otp";

const BCRYPT_ROUNDS = 12;

/**
 * Forgot-password: reset the LOGIN password by emailed one-time code.
 *
 * Deliberately separate from passkey.actions.ts's reset flow, not a shared
 * helper — that one runs for a signed-in user resetting their second
 * factor; this one runs for someone with no session at all, which changes
 * the security shape in one important way: the request step must never
 * reveal whether the email it was given belongs to a real account. Every
 * response on that step is identical regardless.
 */

function normaliseEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

// The generic post-request message lives in validators/auth.ts, not here —
// a "use server" file may only export async functions, so a plain string
// constant can't sit in this module at all. Turbopack enforces this at
// build time; tsc's own check doesn't catch it.

// ── Request a code ───────────────────────────────────────────────────────

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = normaliseEmail(formData.get("email"));
  if (!email || !email.includes("@")) {
    // The one thing this step is allowed to validate: that something
    // email-shaped was typed. It says nothing about whether it matches
    // an account.
    return actionError("Enter a valid email address");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same response whether the account doesn't exist, is deactivated, or is
  // real and about to receive a code — an attacker probing emails must not
  // be able to tell which. Nothing else in this function is allowed to
  // return early with a different message.
  if (user && user.isActive) {
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const requestHeaders = await headers();
    const ipAddress = getClientIp(requestHeaders);
    const userAgent = requestHeaders.get("user-agent");

    await prisma.$transaction(async (tx) => {
      // One live code at a time, same reasoning as the passkey flow: a
      // second request must invalidate the first, or every request widens
      // the window for guessing.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, codeHash, expiresAt: otpExpiry() },
      });
      await writeAuditEvent(tx, {
        entityType: "User",
        entityId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        actorUserId: user.id,
        actorEmail: user.email,
        metadata: { ipAddress, userAgent },
      });
    });

    try {
      await sendEmail({
        to: user.email,
        // Code stays out of the subject for the same reason the passkey
        // reset does: a subject line renders on a locked phone and in
        // inbox previews.
        subject: "ONEVIEW Finance — password reset requested",
        text: [
          `Your password reset code is ${code}.`,
          ``,
          `It expires in ${otpTtlMinutes()} minutes and can be used once.`,
          ``,
          `If you didn't ask to reset your password, someone may have your email —`,
          `you can ignore this message, your password has not been changed.`,
        ].join("\n"),
      });
    } catch (err) {
      // Delivery failed, but the response to the browser must stay generic
      // regardless — logging the real reason server-side is what the
      // person actually gets to see.
      console.error("password reset email failed", err instanceof EmailNotConfiguredError ? err.message : err);
    }
  } else {
    // The identical message above isn't enough on its own: without this, a
    // real account pays a bcrypt hash and a DB transaction that a
    // nonexistent one doesn't, and that time difference is itself an
    // enumeration channel — the same one auth.ts's login already guards
    // against with a dummy bcrypt.compare on a miss.
    //
    // This doesn't reach the email-send step, so a network round trip to
    // Brevo remains a residual (smaller, noisier) timing signal on top of
    // this — closing that fully would mean firing a real request at Brevo
    // for every miss too, which isn't worth it for an internal tool this
    // size.
    await bcrypt.hash("timing-equalisation", BCRYPT_ROUNDS);
  }

  return actionSuccess(undefined);
}

// ── Confirm the code and set a new password ──────────────────────────────

export async function confirmPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = normaliseEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").trim();

  const parsed = resetPasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
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

  const user = await prisma.user.findUnique({ where: { email } });
  // A missing or inactive account reads as "incorrect code" — the exact
  // message a real account with the wrong code would get. Distinguishing
  // them here would undo the request step's care not to leak who has an
  // account.
  const genericCodeError = actionError("Incorrect code", { code: ["Incorrect code"] });
  if (!user || !user.isActive) return genericCodeError;

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return genericCodeError;

  const rejection = otpStateRejection(token);
  if (rejection === "expired") return actionError("That code has expired. Request a new one.");
  if (rejection === "consumed") return actionError("That code has already been used. Request a new one.");
  if (rejection === "too_many_attempts") {
    return actionError("Too many incorrect codes. Request a new one.");
  }

  const matches = await bcrypt.compare(code, token.codeHash);
  if (!matches) {
    const attempts = token.attempts + 1;
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts } });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return actionError(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
        : "Too many incorrect codes. Request a new one.",
      { code: ["Incorrect code"] }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // They just deliberately chose this password, so there is nothing
        // left to force a change into.
        mustChangePassword: false,
        // A successful reset proves ownership of the account — clear any
        // lockout from earlier guessing rather than making them wait it out.
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
      actorUserId: user.id,
      actorEmail: user.email,
    });
  });

  return actionSuccess(undefined);
}
