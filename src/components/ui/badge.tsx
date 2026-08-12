import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-label",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        destructive: "bg-destructive-subtle text-destructive",
        brand: "bg-brand-subtle text-brand",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Renders a small identity dot before the label — status never relies on color alone once paired with the text, but the dot reinforces it at a glance. */
  dot?: boolean;
}

const DOT_COLOR: Record<string, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  brand: "bg-brand",
};

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[variant ?? "neutral"])} />}
      {children}
    </span>
  );
}

const STATUS_VARIANT = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "destructive",
} as const;

const STATUS_LABEL = {
  PAID: "Paid",
  PARTIAL: "Partially paid",
  PENDING: "Pending",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_VARIANT }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
