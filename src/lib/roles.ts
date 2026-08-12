import type { UserRole } from "@prisma/client";

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_ADMIN: "Finance Admin",
  UAE_FINANCE_USER: "UAE Finance",
  INDIA_FINANCE_USER: "India Finance",
  MANAGEMENT_VIEWER: "Viewer",
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  Object.keys(ROLE_LABEL) as UserRole[]
).map((value) => ({ value, label: ROLE_LABEL[value] }));
