import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import {
  canAccessEntityData,
  canManageFx,
  canManageMasterData,
  canManageUsers,
  canWriteEntity,
} from "@/domain/access/permissions";

export {
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

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Cheap JWT-only check — throws if nobody is signed in. Does not re-verify
 * the account is still active; use requireUser() wherever the result feeds
 * a real read or write.
 *
 * Wrapped in React's cache() so the layout → nested layout → page chain
 * (each of which calls this, directly or via requireUser()) shares one
 * result per request instead of re-decoding the JWT repeatedly.
 */
export const requireSession = cache(async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
});

/**
 * The real "who is this, right now" check: re-reads the User row so a
 * deactivated account is rejected immediately rather than riding out its
 * JWT until expiry (JWT sessions don't auto-revoke server-side). Every
 * server action and every data-bearing page should call this, not just
 * requireSession() — it's one indexed lookup, and it's the actual security
 * boundary for "this session is still allowed to act."
 *
 * Wrapped in React's cache(): a route like /operations/uae calls this once
 * via the workspace layout and again via the entity layout, and it's cheap
 * insurance against every future caller adding one more redundant query —
 * without this, each call is a fresh DB round trip per request.
 */
export const requireUser = cache(async function requireUser() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.isActive) throw new UnauthenticatedError();
  return user;
});

async function logDenied(actorId: string, actorEmail: string, reason: string, metadata?: unknown) {
  // Best-effort — a failed audit write must never mask the real
  // ForbiddenError being thrown, so this is never awaited into the throw path.
  writeAuditEvent(prisma, {
    entityType: "AccessControl",
    entityId: actorId,
    action: "ACCESS_DENIED",
    actorUserId: actorId,
    actorEmail,
    metadata: { reason, ...(typeof metadata === "object" && metadata ? metadata : {}) },
  }).catch((err) => console.error("failed to record ACCESS_DENIED audit event", err));
}

/** Throws unless the signed-in user's role can write to the given entity. */
export async function requireEntityWrite(entityCode: string) {
  const user = await requireUser();
  if (!canWriteEntity(user.role, entityCode)) {
    void logDenied(user.id, user.email, "entity_write", { entityCode, role: user.role });
    throw new ForbiddenError(`Your role does not have write access to ${entityCode}.`);
  }
  return user;
}

/** Throws unless the signed-in user's role can at least read the given entity's data. */
export async function requireEntityAccess(entityCode: string) {
  const user = await requireUser();
  if (!canAccessEntityData(user.role, entityCode)) {
    void logDenied(user.id, user.email, "entity_read", { entityCode, role: user.role });
    throw new ForbiddenError(`Your role does not have access to ${entityCode}.`);
  }
  return user;
}

export async function requireMasterDataAccess() {
  const user = await requireUser();
  if (!canManageMasterData(user.role)) {
    void logDenied(user.id, user.email, "master_data");
    throw new ForbiddenError("Only Finance Admins can manage master data.");
  }
  return user;
}

export async function requireFxAccess() {
  const user = await requireUser();
  if (!canManageFx(user.role)) {
    void logDenied(user.id, user.email, "fx_manage");
    throw new ForbiddenError("Only Finance Admins can manage exchange rates.");
  }
  return user;
}

export async function requireUserManagementAccess() {
  const user = await requireUser();
  if (!canManageUsers(user.role)) {
    void logDenied(user.id, user.email, "user_management");
    throw new ForbiddenError("Only a Super Admin can manage users.");
  }
  return user;
}
