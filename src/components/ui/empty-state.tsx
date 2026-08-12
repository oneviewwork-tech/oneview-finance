import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-metadata">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-2">
          <Button size="sm" variant="outline">
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
