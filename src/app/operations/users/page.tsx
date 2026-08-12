import { prisma } from "@/lib/prisma";
import { requireUserManagementAccess } from "@/lib/rbac";
import { UserManagementSection } from "./user-management-section";

export default async function UsersPage() {
  const actor = await requireUserManagementAccess();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastActiveAt: true,
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-muted-foreground">
        Create and manage accounts. Each role is scoped to exactly what that person needs — UAE and India finance
        users never see each other&rsquo;s data, and only Super Admins can manage users.
      </p>
      <div className="mt-6">
        <UserManagementSection users={users} currentUserId={actor.id} />
      </div>
    </div>
  );
}
