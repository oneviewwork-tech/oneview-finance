import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

export function ChartCardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 w-full" style={{ height }} />
    </div>
  );
}

export function TableCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
