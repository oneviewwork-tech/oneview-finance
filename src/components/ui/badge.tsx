import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-ui",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        // Alias of `default` — kept so existing callers across the app
        // (master data toggles, vendor/client status, etc.) don't all need
        // touching in the same pass as this visual refresh.
        neutral: "bg-secondary text-secondary-foreground",
        brand: "bg-brand-subtle text-brand",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        destructive: "bg-destructive-subtle text-destructive",
        outline: "border border-border text-foreground",
        ghost: "text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-success": variant === "success",
            "bg-warning": variant === "warning",
            "bg-destructive": variant === "destructive",
            "bg-brand": variant === "brand",
            "bg-muted-foreground": variant === "default" || variant === "neutral" || !variant,
            "bg-current": variant === "outline" || variant === "ghost",
          })}
        />
      )}
      {children}
    </span>
  );
}

export { StatusBadge } from "./status-badge";
