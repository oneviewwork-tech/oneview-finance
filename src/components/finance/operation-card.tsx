import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { KpiTone } from "@/components/finance/kpi-card";

const TONE_CHIP: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  destructive: "bg-destructive-subtle text-destructive",
  brand: "bg-brand-subtle text-brand",
};

/** Operational summary card that leads toward an action — distinct from KpiCard's passive drill-down pattern. */
export function OperationCard({
  label,
  value,
  meta,
  icon: Icon,
  tone = "default",
  actionLabel,
  actionHref,
}: {
  label: string;
  value: string;
  meta?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-card-title">{label}</span>
          {Icon && (
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", TONE_CHIP[tone])}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          )}
        </div>
        <div className="mt-1.5 text-metric">{value}</div>
        {meta && <p className="mt-1 text-metadata">{meta}</p>}
        {actionLabel && actionHref && (
          <Link href={actionHref} className="mt-3 block">
            <Button size="sm" variant="outline" className="w-full">
              {actionLabel}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
