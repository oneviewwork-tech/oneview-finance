import { requireUser } from "@/lib/rbac";

/**
 * The real signed-in actor, resolved from the session (Phase 6). Kept as a
 * thin re-export so every action that already imports getCurrentUser()
 * keeps working unchanged — the return shape (a full User row) hasn't
 * changed since the Phase 2 placeholder this replaced.
 *
 * This only resolves *who* is acting — it does not check *whether* they're
 * allowed to do what they're about to do. Actions that touch a specific
 * entity's data must additionally call requireEntityWrite()/
 * requireEntityAccess() from @/lib/rbac, which return the same user object
 * so callers don't need two separate lookups.
 */
export async function getCurrentUser() {
  return requireUser();
}
