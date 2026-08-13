import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { requiresPasskey, roleUsesPasskey, isPasskeyRoute, isApiPath } from "@/domain/auth/passkey-policy";

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "MANAGEMENT_VIEWER",
  "UAE_FINANCE_USER",
  "INDIA_FINANCE_USER",
];

describe("requiresPasskey", () => {
  it("gates every route for a Super Admin", () => {
    for (const path of ["/", "/operations", "/operations/uae/inflow", "/intelligence"]) {
      expect(requiresPasskey("SUPER_ADMIN", path, false)).toBe(true);
    }
  });

  it("gates Finance View for every role that can reach it", () => {
    for (const role of ALL_ROLES) {
      expect(requiresPasskey(role, "/intelligence", false)).toBe(true);
      expect(requiresPasskey(role, "/intelligence/breakdown", false)).toBe(true);
    }
  });

  // Data entry shouldn't get slower — an entity finance user working in
  // Accounts all day never touches consolidated reporting.
  it("leaves Accounts alone for entity finance users", () => {
    for (const role of ["UAE_FINANCE_USER", "INDIA_FINANCE_USER"] as UserRole[]) {
      expect(requiresPasskey(role, "/operations", false)).toBe(false);
      expect(requiresPasskey(role, "/operations/uae/outflow", false)).toBe(false);
      expect(requiresPasskey(role, "/", false)).toBe(false);
    }
  });

  it("never gates once verified", () => {
    for (const role of ALL_ROLES) {
      for (const path of ["/", "/operations", "/intelligence"]) {
        expect(requiresPasskey(role, path, true)).toBe(false);
      }
    }
  });

  // Gating the gate would be an infinite redirect.
  it("never gates the auth pages themselves", () => {
    for (const path of ["/passkey", "/login", "/change-password", "/api/auth/session"]) {
      expect(requiresPasskey("SUPER_ADMIN", path, false)).toBe(false);
    }
  });

  it("does not gate signed-out requests — login comes first", () => {
    expect(requiresPasskey(undefined, "/intelligence", false)).toBe(false);
  });

  // "/intelligencefoo" is not a Finance View route; a prefix test that
  // ignored the boundary would gate unrelated paths and, worse, a similar
  // bug in the other direction would leave real ones open.
  it("matches route boundaries, not bare prefixes", () => {
    expect(requiresPasskey("MANAGEMENT_VIEWER", "/intelligencefoo", false)).toBe(false);
    expect(requiresPasskey("MANAGEMENT_VIEWER", "/intelligence/fx", false)).toBe(true);
  });
});

describe("roleUsesPasskey", () => {
  it("covers Super Admin and the Finance View roles", () => {
    expect(roleUsesPasskey("SUPER_ADMIN")).toBe(true);
    expect(roleUsesPasskey("MANAGEMENT_VIEWER")).toBe(true);
    expect(roleUsesPasskey("FINANCE_ADMIN")).toBe(true);
  });

  it("excludes entity finance users", () => {
    expect(roleUsesPasskey("UAE_FINANCE_USER")).toBe(false);
    expect(roleUsesPasskey("INDIA_FINANCE_USER")).toBe(false);
  });
});

describe("export API", () => {
  // The gate would be decorative if the dashboard were blocked while the
  // endpoint that emits the same rows stayed open.
  it("gates the export endpoint for a Super Admin", () => {
    expect(requiresPasskey("SUPER_ADMIN", "/api/export/transactions", false)).toBe(true);
  });

  it("still lets NextAuth's own endpoints through", () => {
    expect(requiresPasskey("SUPER_ADMIN", "/api/auth/session", false)).toBe(false);
    expect(requiresPasskey("SUPER_ADMIN", "/api/auth/callback/credentials", false)).toBe(false);
  });

  it("identifies API paths so they can be refused rather than redirected", () => {
    expect(isApiPath("/api/export/transactions")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
    expect(isApiPath("/intelligence")).toBe(false);
  });
});

describe("isPasskeyRoute", () => {
  it("recognises the gate and its sub-paths", () => {
    expect(isPasskeyRoute("/passkey")).toBe(true);
    expect(isPasskeyRoute("/passkey/reset")).toBe(true);
  });

  it("does not match lookalikes", () => {
    expect(isPasskeyRoute("/passkeys")).toBe(false);
    expect(isPasskeyRoute("/")).toBe(false);
  });
});
