"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-segment error boundary — catches anything thrown while rendering,
 * loading data, or in an event handler anywhere under this segment, and
 * replaces Next.js's bare "This page couldn't load" fallback with something
 * that matches the rest of the app and gives the user somewhere to go.
 *
 * Does NOT catch errors in the root layout itself — that's global-error.tsx,
 * which needs its own <html>/<body> since layout.tsx may be what threw.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server-side stack traces don't reach the browser console on their own;
    // this is the only place a client-side observer (or Vercel's own log
    // capture) sees this ever happened.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive-subtle">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="mt-5 text-section-title text-foreground">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page hit an unexpected error. It&rsquo;s been logged — try again, or head back to Finance View.
      </p>
      {/* A digest, never the raw message/stack: those can carry query
          parameters or internal detail that doesn't belong on screen, but a
          short reference code lets support find the matching server log. */}
      {error.digest && <p className="mt-3 text-metadata text-muted-foreground/70">Reference: {error.digest}</p>}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} className="gap-2">
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
        <Link href="/intelligence">
          <Button variant="outline">Go to Finance View</Button>
        </Link>
      </div>
    </div>
  );
}
