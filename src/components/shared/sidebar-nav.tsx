"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Upload,
  Database,
  UserCog,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

const ICONS = {
  dashboard: LayoutDashboard,
  accounts: Wallet,
  fx: ArrowRightLeft,
  import: Upload,
  data: Database,
  users: UserCog,
} as const;

type IconKey = keyof typeof ICONS;

export interface SidebarNavChild {
  label: string;
  href: string;
  icon?: IconKey;
}

export interface SidebarNavItem {
  key: "intelligence" | "operations";
  label: string;
  icon: IconKey;
  href: string;
  children: SidebarNavChild[];
}

export function SidebarNav({
  workspace,
  items,
  user,
}: {
  workspace: "intelligence" | "operations";
  items: SidebarNavItem[];
  user: { name: string; email: string; roleLabel: string };
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isChildActive(child: SidebarNavChild): boolean {
    const [childPath, childQuery] = child.href.split("?");
    if (pathname !== childPath) return false;
    const expectedEntity = childQuery ? new URLSearchParams(childQuery).get("entity") : null;
    return expectedEntity === searchParams.get("entity");
  }

  return (
    <aside className="dark fixed inset-y-0 left-0 z-30 flex w-16 flex-col items-center border-r border-border bg-card py-3">
      <Link href="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-[0.6875rem] font-bold text-brand-foreground">
        O
      </Link>

      <p className="mt-5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Main</p>

      <nav className="mt-2 flex w-full flex-col items-center gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.key === workspace;
          const open = openKey === item.key;
          return (
            <div
              key={item.key}
              className="relative w-full px-2"
              onMouseEnter={() => setOpenKey(item.key)}
              onMouseLeave={() => setOpenKey((k) => (k === item.key ? null : k))}
            >
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-md transition-ui",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" />
              </Link>

              {open && (
                <div className="absolute left-full top-0 z-40 ml-2 w-48 rounded-lg border border-border bg-card p-1.5 shadow-lg">
                  <p className="px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  {item.children.map((child) => {
                    const ChildIcon = child.icon ? ICONS[child.icon] : null;
                    const childActive = isChildActive(child);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-ui",
                          childActive ? "bg-accent text-foreground" : "text-foreground/90 hover:bg-accent/60"
                        )}
                      >
                        {ChildIcon && <ChildIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-3">
        <ThemeToggle />

        <div className="relative" onMouseLeave={() => setUserMenuOpen(false)}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground transition-ui hover:opacity-90"
            aria-label="Account menu"
          >
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-0 left-full z-40 ml-2 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
              <p className="text-sm font-medium">{user.name || user.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{user.roleLabel}</p>
              <form action={logout} className="mt-3">
                <Button type="submit" variant="outline" size="sm" className="w-full justify-start gap-2">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
