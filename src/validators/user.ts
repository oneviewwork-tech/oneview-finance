import { z } from "zod";
import { passwordSchema } from "./auth";

export const USER_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "UAE_FINANCE_USER",
  "INDIA_FINANCE_USER",
  "MANAGEMENT_VIEWER",
] as const;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  name: z.string().trim().min(1, "Name is required").max(200),
  role: z.enum(USER_ROLES),
  temporaryPassword: passwordSchema,
});

export const setUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});
