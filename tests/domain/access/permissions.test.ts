import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import {
  canAccessEntityData,
  canAccessOperations,
  canManageFx,
  canManageMasterData,
  canManageUsers,
  canViewIntelligenceEntity,
  canWriteEntity,
  defaultIntelligenceEntity,
  entityScopeForRole,
} from "@/domain/access/permissions";

const ALL_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "UAE_FINANCE_USER", "INDIA_FINANCE_USER", "MANAGEMENT_VIEWER"];

describe("entityScopeForRole", () => {
  it("scopes finance users to their own entity and leaves everyone else unrestricted", () => {
    expect(entityScopeForRole("UAE_FINANCE_USER")).toBe("UAE");
    expect(entityScopeForRole("INDIA_FINANCE_USER")).toBe("INDIA");
    expect(entityScopeForRole("SUPER_ADMIN")).toBeNull();
    expect(entityScopeForRole("FINANCE_ADMIN")).toBeNull();
    expect(entityScopeForRole("MANAGEMENT_VIEWER")).toBeNull();
  });
});

describe("canWriteEntity — the core cross-entity isolation guarantee", () => {
  it("a UAE finance user can write UAE but never India", () => {
    expect(canWriteEntity("UAE_FINANCE_USER", "UAE")).toBe(true);
    expect(canWriteEntity("UAE_FINANCE_USER", "INDIA")).toBe(false);
  });

  it("an India finance user can write India but never UAE", () => {
    expect(canWriteEntity("INDIA_FINANCE_USER", "INDIA")).toBe(true);
    expect(canWriteEntity("INDIA_FINANCE_USER", "UAE")).toBe(false);
  });

  it("admins can write both entities", () => {
    for (const entity of ["UAE", "INDIA"]) {
      expect(canWriteEntity("SUPER_ADMIN", entity)).toBe(true);
      expect(canWriteEntity("FINANCE_ADMIN", entity)).toBe(true);
    }
  });

  it("the viewer can never write, in either entity", () => {
    expect(canWriteEntity("MANAGEMENT_VIEWER", "UAE")).toBe(false);
    expect(canWriteEntity("MANAGEMENT_VIEWER", "INDIA")).toBe(false);
  });
});

describe("canAccessEntityData — broader than write, but still entity-isolated for finance users", () => {
  it("the viewer can read both entities despite never writing either", () => {
    expect(canAccessEntityData("MANAGEMENT_VIEWER", "UAE")).toBe(true);
    expect(canAccessEntityData("MANAGEMENT_VIEWER", "INDIA")).toBe(true);
  });

  it("a UAE finance user still cannot read India data", () => {
    expect(canAccessEntityData("UAE_FINANCE_USER", "UAE")).toBe(true);
    expect(canAccessEntityData("UAE_FINANCE_USER", "INDIA")).toBe(false);
  });
});

describe("canAccessOperations", () => {
  it("everyone except the viewer gets Financial Operations", () => {
    for (const role of ALL_ROLES) {
      expect(canAccessOperations(role)).toBe(role !== "MANAGEMENT_VIEWER");
    }
  });
});

describe("canViewIntelligenceEntity", () => {
  it("admins and the viewer get the combined view", () => {
    expect(canViewIntelligenceEntity("SUPER_ADMIN", "ALL")).toBe(true);
    expect(canViewIntelligenceEntity("FINANCE_ADMIN", "ALL")).toBe(true);
    expect(canViewIntelligenceEntity("MANAGEMENT_VIEWER", "ALL")).toBe(true);
  });

  it("entity-scoped finance users do not get the combined view", () => {
    expect(canViewIntelligenceEntity("UAE_FINANCE_USER", "ALL")).toBe(false);
    expect(canViewIntelligenceEntity("INDIA_FINANCE_USER", "ALL")).toBe(false);
  });

  it("entity-scoped finance users get their own single-entity dashboard only", () => {
    expect(canViewIntelligenceEntity("UAE_FINANCE_USER", "UAE")).toBe(true);
    expect(canViewIntelligenceEntity("UAE_FINANCE_USER", "INDIA")).toBe(false);
    expect(canViewIntelligenceEntity("INDIA_FINANCE_USER", "INDIA")).toBe(true);
    expect(canViewIntelligenceEntity("INDIA_FINANCE_USER", "UAE")).toBe(false);
  });
});

describe("defaultIntelligenceEntity", () => {
  it("sends entity-scoped roles to their own entity, everyone else to Combined", () => {
    expect(defaultIntelligenceEntity("UAE_FINANCE_USER")).toBe("UAE");
    expect(defaultIntelligenceEntity("INDIA_FINANCE_USER")).toBe("INDIA");
    expect(defaultIntelligenceEntity("SUPER_ADMIN")).toBe("ALL");
    expect(defaultIntelligenceEntity("MANAGEMENT_VIEWER")).toBe("ALL");
  });
});

describe("admin-only capabilities", () => {
  it("master data, FX management: only SUPER_ADMIN and FINANCE_ADMIN", () => {
    for (const role of ALL_ROLES) {
      const expected = role === "SUPER_ADMIN" || role === "FINANCE_ADMIN";
      expect(canManageMasterData(role)).toBe(expected);
      expect(canManageFx(role)).toBe(expected);
    }
  });

  it("user management: SUPER_ADMIN only, not even FINANCE_ADMIN", () => {
    expect(canManageUsers("SUPER_ADMIN")).toBe(true);
    expect(canManageUsers("FINANCE_ADMIN")).toBe(false);
    for (const role of ALL_ROLES) {
      if (role !== "SUPER_ADMIN") expect(canManageUsers(role)).toBe(false);
    }
  });
});
