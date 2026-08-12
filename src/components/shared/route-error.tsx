"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared error boundary UI — never exposes the raw error/stack to the user. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  if (error.name === "ForbiddenError") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium">You don&rsquo;t have access to this</p>
          <p className="mt-1 text-metadata">Your role doesn&rsquo;t permit viewing this page.</p>
        </div>
        <Link href="/">
          <Button size="sm" variant="outline">
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium">Unable to load financial data</p>
        <p className="mt-1 text-metadata">We couldn&rsquo;t retrieve the latest data. Please try again.</p>
      </div>
      <Button size="sm" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
