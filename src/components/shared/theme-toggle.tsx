"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oneview-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored === "dark" || stored === "light" ? stored : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function apply(next: "light" | "dark") {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/60 p-0.5">
      {(
        [
          { value: "light", label: "Light theme", Icon: Sun },
          { value: "dark", label: "Dark theme", Icon: Moon },
        ] as const
      ).map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          aria-label={label}
          aria-pressed={theme === value}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[5px] transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            theme === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
