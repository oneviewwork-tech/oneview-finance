import { Skeleton } from "@/components/ui/skeleton";
import { KpiCardSkeleton, ChartCardSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function IntelligenceLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-2 h-3.5 w-64" />
        </div>
        <Skeleton className="h-8 w-64" />
      </div>

      <Skeleton className="h-11 w-full" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <TableCardSkeleton />
    </div>
  );
}
