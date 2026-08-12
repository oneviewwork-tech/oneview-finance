import { requireSession, canAccessOperations, canManageMasterData, canManageUsers } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/roles";
import { SidebarNav, type SidebarNavItem } from "./sidebar-nav";

export async function Sidebar({ workspace }: { workspace: "intelligence" | "operations" }) {
  const session = await requireSession();
  const { name, email, role } = session.user;

  const items: SidebarNavItem[] = [
    {
      key: "intelligence",
      label: "Finance View",
      icon: "dashboard",
      href: "/intelligence",
      children: [
        { label: "Combined", href: "/intelligence" },
        { label: "UAE", href: "/intelligence?entity=UAE" },
        { label: "India", href: "/intelligence?entity=INDIA" },
        { label: "Exchange Rate", href: "/intelligence/fx", icon: "fx" },
      ],
    },
  ];

  if (canAccessOperations(role)) {
    items.push({
      key: "operations",
      label: "Accounts",
      icon: "accounts",
      href: "/operations",
      children: [
        { label: "UAE", href: "/operations/uae" },
        { label: "India", href: "/operations/india" },
        { label: "Import", href: "/operations/import", icon: "import" },
        ...(canManageMasterData(role) ? [{ label: "Master Data", href: "/operations/categories", icon: "data" as const }] : []),
        ...(canManageUsers(role) ? [{ label: "Users", href: "/operations/users", icon: "users" as const }] : []),
      ],
    });
  }

  return (
    <SidebarNav
      workspace={workspace}
      items={items}
      user={{ name: name ?? "", email: email ?? "", roleLabel: ROLE_LABEL[role] }}
    />
  );
}
