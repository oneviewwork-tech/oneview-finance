import { Skeleton } from "@/components/ui/skeleton";

export default function OperationsLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-52" />
      <Skeleton className="mt-2 h-3.5 w-80" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
