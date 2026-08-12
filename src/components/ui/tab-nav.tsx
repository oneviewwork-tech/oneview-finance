"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabNavItem {
  href: string;
  label: string;
  /** Defaults to exact match; set true for a section root that should also match its own sub-routes. */
  matchPrefix?: boolean;
}

/** Route-driven tab navigation with a clear underline active state — for switching between real pages (Overview/Inflow/Outflow/…), not client-side filter state (see SegmentedControl for that). */
export function TabNav({ items }: { items: TabNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {items.map((item) => {
        const active = item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-ui",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}
