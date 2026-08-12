import { z } from "zod";

// Minimum bar for a financial system: length + a mix of character classes,
// not just length alone. Deliberately not requiring a specific special
// character (that pushes people toward "Password1!" patterns) — length and
// variety matter more than a mandated symbol.
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200)
  .refine((v) => /[a-z]/.test(v), "Password must include a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Password must include an uppercase letter")
  .refine((v) => /[0-9]/.test(v), "Password must include a number");

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
