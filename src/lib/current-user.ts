import { prisma } from "@/lib/prisma";

/**
 * TEMPORARY (Phase 2 -> Phase 6 bridge). NextAuth isn't wired up yet
 * (that's Phase 6: RBAC + Audit), but every write in this app requires a
 * real User row for created_by/audit attribution — the schema does not
 * allow a nullable "system" actor. Until real sessions exist, every
 * server action attributes writes to the seeded Super Admin.
 *
 * When Phase 6 lands, this function's body gets replaced with a call to
 * `auth()` and a lookup of `session.user.id` — nothing that calls
 * `getCurrentUser()` today needs to change, since the return shape stays
 * the same.
 */
export async function getCurrentUser() {
  const user = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    throw new Error(
      "No active Super Admin user found — run `npm run db:seed` before using Financial Operations."
    );
  }
  return user;
}
