import { z } from "zod";

// Minimum bar for a financial system: length + a mix of character classes,
// not just length alone. Deliberately not requiring a specific special
// character (that pushes people toward "Password1!" patterns) — length and
// variety matter more than a mandated symbol.
export const PASSWORD_MIN_LENGTH = 6;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200)
  .refine((v) => /[a-z]/.test(v), "Password must include a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Password must include an uppercase letter")
  .refine((v) => /[0-9]/.test(v), "Password must include a number");

// Shown next to every password input. Lives here so it can't drift from the
// rules above — an admin shouldn't have to fail a submit to learn the rule.
export const PASSWORD_RULE_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, and a number.`;

// The passkey is a second factor, not a second password. Requiring the same
// length and character mix would push people to reuse their password, which
// would defeat the point — so this is a shorter, distinct secret, and the
// action refuses one that matches the account password.
export const PASSKEY_MIN_LENGTH = 6;
export const PASSKEY_MAX_LENGTH = 64;

export const passkeySchema = z
  .string()
  .min(PASSKEY_MIN_LENGTH, `Passkey must be at least ${PASSKEY_MIN_LENGTH} characters`)
  .max(PASSKEY_MAX_LENGTH, `Passkey must be at most ${PASSKEY_MAX_LENGTH} characters`);

export const PASSKEY_RULE_HINT = `At least ${PASSKEY_MIN_LENGTH} characters. Must be different from your password.`;

export const setPasskeySchema = z
  .object({
    passkey: passkeySchema,
    confirmPasskey: z.string().min(1, "Confirm your passkey"),
  })
  .refine((d) => d.passkey === d.confirmPasskey, {
    message: "Passkeys do not match",
    path: ["confirmPasskey"],
  });

// Shown by the forgot-password client after a request, and referenced by
// password-reset.actions.ts's own comments — kept here, not there, because
// a "use server" file may only export async functions.
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, a reset code has been sent. Check your inbox (and spam folder).";

// Same rule as changePasswordSchema minus the "know your current password"
// step, since that is precisely what a forgot-password flow can't ask for.
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });
