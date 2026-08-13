import type { UserRole } from "@prisma/client";

/**
 * Who has to clear the passkey gate, and where.
 *
 * Pure and dependency-free so it can run in the Edge proxy and be tested
 * directly — the decision to demand a second factor must not depend on
 * anything that might be unavailable mid-request.
 *
 * ── LOCKOUT RECOVERY ────────────────────────────────────────────────────
 * A Super Admin is gated on EVERY route, so one who forgets their passkey
 * while email delivery is broken cannot reach any page — including the one
 * that would let another admin help them. The forgot-passkey flow depends
 * on RESEND_API_KEY + EMAIL_FROM being set; verify email works BEFORE the
 * first Super Admin sets a passkey.
 *
 * If it happens anyway, the only way back in is the database:
 *
 *   UPDATE "User" SET "passkeyHash" = NULL,
 *                     "passkeyFailedAttempts" = 0,
 *                     "passkeyLockedUntil" = NULL
 *   WHERE email = '<the locked-out account>';
 *
 * The next sign-in then offers "Create your passkey" instead of "Enter".
 * This is intentionally not exposed in the app: an in-app way to clear
 * your own second factor would not be a second factor.
 */

/** Pages that make up the gate itself. Demanding a passkey to reach the
 *  passkey form would be an infinite redirect. */
export const PASSKEY_ROUTES = ["/passkey"] as const;

/** Reachable without clearing the gate: auth flows and the sign-out path. */
const ALWAYS_ALLOWED = ["/login", "/change-password", "/passkey", "/api/auth"];

/**
 * Super Admins carry the highest privilege in the system — they can create
 * users, change roles, and read both entities — so their whole session is
 * gated, not just the reporting pages.
 */
function roleAlwaysRequiresPasskey(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Finance View is the consolidated reporting surface: revenue, liabilities,
 * net position across both entities. That's the material a second factor is
 * meant to protect, regardless of who is looking at it.
 */
function pathIsFinanceView(pathname: string): boolean {
  return pathname === "/intelligence" || pathname.startsWith("/intelligence/");
}

/**
 * Requests that must be refused rather than redirected.
 *
 * A download or fetch can't follow a redirect to a login-style page in any
 * useful way — the caller would receive HTML where it expected a file. More
 * importantly, gating only the pages while leaving the export endpoint open
 * would make the gate decorative: /api/export emits the very rows the
 * dashboard shows.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPasskeyRoute(pathname: string): boolean {
  return pathname === "/passkey" || pathname.startsWith("/passkey/");
}

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * True when this request must be blocked until the passkey is verified.
 *
 * Deliberately takes the already-verified flag: callers that have proof of
 * step-up pass `true` and get `false` back, so there is exactly one place
 * that knows the rule.
 */
export function requiresPasskey(
  role: UserRole | undefined,
  pathname: string,
  alreadyVerified: boolean
): boolean {
  if (!role) return false; // not signed in — the login gate handles it first
  if (alreadyVerified) return false;
  if (isAlwaysAllowed(pathname)) return false;
  return roleAlwaysRequiresPasskey(role) || pathIsFinanceView(pathname);
}

/**
 * Whether a role will ever be asked for a passkey. Used to decide if the
 * "set up your passkey" prompt is relevant to someone — an entity finance
 * user who never opens Finance View shouldn't be nagged to create one.
 */
export function roleUsesPasskey(role: UserRole): boolean {
  if (roleAlwaysRequiresPasskey(role)) return true;
  // Anyone who can open Finance View will eventually hit the gate. Entity
  // finance users work only in Accounts, so they never do.
  return role === "MANAGEMENT_VIEWER" || role === "FINANCE_ADMIN";
}
