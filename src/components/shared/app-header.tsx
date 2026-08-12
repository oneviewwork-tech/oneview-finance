import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const WORKSPACES = [
  { key: "intelligence", label: "Financial Intelligence", href: "/intelligence" },
  { key: "operations", label: "Financial Operations", href: "/operations" },
] as const;

export function AppHeader({
  workspace,
  actions,
}: {
  workspace: "intelligence" | "operations";
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[0.6875rem] font-bold text-brand-foreground">
            O
          </span>
          <span className="hidden text-[0.9375rem] font-semibold tracking-tight sm:inline">
            ONEVIEW <span className="font-medium text-muted-foreground">Finance</span>
          </span>
        </Link>

        <nav className="flex h-full items-center gap-1 overflow-x-auto">
          {WORKSPACES.map((ws) => {
            const active = ws.key === workspace;
            return (
              <Link
                key={ws.key}
                href={ws.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full shrink-0 items-center px-1 text-sm font-medium transition-ui",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {ws.label}
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
