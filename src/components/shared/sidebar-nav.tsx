"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Upload,
  Database,
  UserCog,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  accounts: Wallet,
  fx: ArrowRightLeft,
  import: Upload,
  data: Database,
  users: UserCog,
};

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
  items,
  user,
}: {
  items: SidebarNavItem[];
  user: { name: string; email: string; roleLabel: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Derived from the real URL, not the user's role — a Super Admin browsing
  // /intelligence should see Finance View expanded, not Accounts, even
  // though their role would technically permit either.
  const activeKey: "intelligence" | "operations" = pathname.startsWith("/operations") ? "operations" : "intelligence";
  const [manuallyOpened, setManuallyOpened] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);

  // Click-outside + Escape, matching PopoverMenu. An earlier onMouseLeave
  // version closed the menu whenever the pointer crossed the gap between the
  // trigger and the panel, which made Sign out effectively unclickable.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        userTriggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  function isChildActive(child: SidebarNavChild): boolean {
    const [childPath, childQuery] = child.href.split("?");
    if (pathname !== childPath) return false;
    const expectedEntity = childQuery ? new URLSearchParams(childQuery).get("entity") : null;
    return expectedEntity === searchParams.get("entity");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <Image src="/logo-haris.jpg" alt="Haris & Co." width={32} height={32} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">ONEVIEW</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Finance</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.key === activeKey;
          const open = manuallyOpened === item.key || (manuallyOpened === null && active);

          return (
            <div key={item.key} className="space-y-0.5">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-ui",
                  active ? "bg-brand-subtle text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Link href={item.href} className="flex flex-1 items-center gap-3 focus-visible:outline-none">
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
                {item.children.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManuallyOpened(open ? "" : item.key)}
                    aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                  </button>
                )}
              </div>

              {open && item.children.length > 0 && (
                <div className="ml-6 space-y-0.5 border-l border-border pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon ? ICONS[child.icon] : null;
                    const childActive = isChildActive(child);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-ui",
                          childActive ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {ChildIcon && <ChildIcon className="h-3.5 w-3.5" />}
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

      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
        </div>

        <div ref={userMenuRef} className="relative">
          <button
            ref={userTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-ui hover:bg-accent",
              userMenuOpen && "bg-accent"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user.name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
            </div>
            <ChevronRight
              className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", userMenuOpen && "-rotate-90")}
            />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
            >
              <div className="border-b border-border px-2 pb-2 pt-1">
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <form action={logout} className="pt-1.5">
                <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <LogOut className="h-4 w-4" />
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
