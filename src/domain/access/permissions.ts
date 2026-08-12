import type { UserRole } from "@prisma/client";

// ── The permission matrix — every access rule in one place, and pure ──
// (no session, no Prisma, no NextAuth — safe to unit test directly and
// safe to import from the Edge-runtime middleware if ever needed).
//
// SUPER_ADMIN / FINANCE_ADMIN: unrestricted across both entities.
// UAE_FINANCE_USER / INDIA_FINANCE_USER: read+write their own entity only,
//   no access to the other entity's data, no master data / FX / user admin.
// MANAGEMENT_VIEWER: read-only everywhere, no Financial Operations access
//   at all (they don't enter data — that's the point of the role).

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN"];
const WRITE_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "UAE_FINANCE_USER", "INDIA_FINANCE_USER"];

/** The single entity a role is confined to, or null for a role with no such restriction (admins are unrestricted; viewer has no write scope at all). */
export function entityScopeForRole(role: UserRole): "UAE" | "INDIA" | null {
  if (role === "UAE_FINANCE_USER") return "UAE";
  if (role === "INDIA_FINANCE_USER") return "INDIA";
  return null;
}

/** Broad read access — can this role see this entity's data at all (Operations or Intelligence)? */
export function canAccessEntityData(role: UserRole, entityCode: string): boolean {
  if (role === "SUPER_ADMIN" || role === "FINANCE_ADMIN" || role === "MANAGEMENT_VIEWER") return true;
  return entityScopeForRole(role) === entityCode;
}

/** Narrower than canAccessEntityData: excludes the read-only viewer role. */
export function canWriteEntity(role: UserRole, entityCode: string): boolean {
  if (!WRITE_ROLES.includes(role)) return false;
  const scope = entityScopeForRole(role);
  return scope === null || scope === entityCode;
}

/** MANAGEMENT_VIEWER never gets Financial Operations — it exists to view, not enter, data. */
export function canAccessOperations(role: UserRole): boolean {
  return role !== "MANAGEMENT_VIEWER";
}

export function canViewIntelligenceEntity(role: UserRole, selector: "ALL" | "UAE" | "INDIA"): boolean {
  if (role === "SUPER_ADMIN" || role === "FINANCE_ADMIN" || role === "MANAGEMENT_VIEWER") return true;
  if (selector === "ALL") return false; // entity-scoped finance users don't get the combined view
  return entityScopeForRole(role) === selector;
}

/** Where an entity-scoped role should land when they hit a page they can't use in its default state (e.g. /intelligence with no ?entity=). */
export function defaultIntelligenceEntity(role: UserRole): "ALL" | "UAE" | "INDIA" {
  const scope = entityScopeForRole(role);
  return scope ?? "ALL";
}

export function canManageMasterData(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageFx(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageUsers(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
