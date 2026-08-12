import { Skeleton } from "@/components/ui/skeleton";

export default function EntityOperationsLoading() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
