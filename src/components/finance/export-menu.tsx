"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Export picker. Each option is a plain link — the endpoint sets
 * Content-Disposition, so the browser downloads natively and no fetch/blob
 * dance is needed.
 */
export function ExportMenu({
  entityId,
  type,
}: {
  entityId: string;
  /**
   * Which table the CSV option exports. Omit on a page that isn't about one
   * of them (the entity overview) and both CSVs are offered instead — Excel
   * and PDF always cover the whole entity either way.
   */
  type?: "INFLOW" | "OUTFLOW";
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

  // No range params — the endpoint reads that as "export the full history".
  const base = `/api/export/transactions?entityId=${encodeURIComponent(entityId)}`;
  const csvOptions = type
    ? [
        {
          href: `${base}&format=csv&type=${type}`,
          icon: Table2,
          label: "CSV",
          hint: `${type === "INFLOW" ? "Inflow" : "Outflow"} rows only`,
        },
      ]
    : [
        { href: `${base}&format=csv&type=INFLOW`, icon: Table2, label: "Inflow CSV", hint: "Inflow Tracker rows" },
        { href: `${base}&format=csv&type=OUTFLOW`, icon: Table2, label: "Outflow CSV", hint: "Payment Tracker rows" },
      ];

  const options = [
    ...csvOptions,
    {
      href: `${base}&format=xlsx`,
      icon: FileSpreadsheet,
      label: "Excel workbook",
      hint: "Same layout as the Zoho sheet — re-importable",
    },
    {
      href: `${base}&format=pdf`,
      icon: FileText,
      label: "PDF report",
      hint: "Formatted summary for sharing",
    },
  ];

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      {open && (
        <div
          role="menu"
          className="popover-panel absolute right-0 z-40 mt-1.5 w-64 overflow-hidden p-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {options.map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              download
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-ui hover:bg-accent"
              )}
            >
              <opt.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-metadata">{opt.hint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
