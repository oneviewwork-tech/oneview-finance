"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight popover trigger + panel. Native <select> can't be styled
 * (the OS draws the option list), so anything that needs a premium
 * surface, sections or a check mark uses this instead.
 *
 * Handles the accessibility basics a real menu needs: click-outside and
 * Escape to close, focus returned to the trigger, aria-expanded wired up.
 */
export function PopoverMenu({
  label,
  children,
  align = "end",
  className,
  panelClassName,
  icon,
}: {
  label: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-[0.8125rem] font-medium shadow-xs transition-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "border-brand ring-2 ring-ring",
          className
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-ui", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1.5 min-w-52 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            align === "end" ? "right-0" : "left-0",
            panelClassName
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

export function MenuItem({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[0.8125rem] transition-ui",
        // Hover stays a ghost wash so it never competes with the selected row.
        selected ? "bg-brand-subtle font-medium text-brand" : "hover:bg-accent"
      )}
    >
      <span className="truncate">{children}</span>
      {selected && <CheckMark />}
    </button>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}
