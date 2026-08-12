import { SidebarNav, type SidebarNavItem } from "./sidebar-nav";
import { requireUser, canAccessOperations, canAccessEntityData, canManageUsers, canManageMasterData } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { entitySlug } from "@/lib/entities";

export async function Sidebar() {
  const user = await requireUser();

  const intelligenceChildren: { label: string; href: string; icon?: "fx" }[] = [
    { label: "Combined", href: "/intelligence" },
    { label: "UAE", href: "/intelligence?entity=UAE" },
    { label: "India", href: "/intelligence?entity=INDIA" },
    { label: "Exchange Rate", href: "/intelligence/fx", icon: "fx" },
  ];

  const operationsChildren: { label: string; href: string; icon?: "import" | "data" | "users" }[] = [];

  if (canAccessOperations(user.role)) {
    const entities = await prisma.businessEntity.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
    for (const e of entities) {
      if (canAccessEntityData(user.role, e.code)) {
        operationsChildren.push({ label: e.name, href: `/operations/${entitySlug(e.code)}` });
      }
    }
    operationsChildren.push({ label: "Import", href: "/operations/import", icon: "import" });
    if (canManageMasterData(user.role)) {
      operationsChildren.push({ label: "Master Data", href: "/operations/categories", icon: "data" });
    }
    if (canManageUsers(user.role)) {
      operationsChildren.push({ label: "Users", href: "/operations/users", icon: "users" });
    }
  }

  const items: SidebarNavItem[] = [
    { key: "intelligence", label: "Finance View", icon: "dashboard", href: "/intelligence", children: intelligenceChildren },
  ];
  if (canAccessOperations(user.role)) {
    items.push({ key: "operations", label: "Accounts", icon: "accounts", href: "/operations", children: operationsChildren });
  }

  return <SidebarNav items={items} user={{ name: user.name, email: user.email, roleLabel: ROLE_LABEL[user.role] }} />;
}
