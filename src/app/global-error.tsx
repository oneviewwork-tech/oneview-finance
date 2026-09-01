"use client";

import { useEffect } from "react";
import Script from "next/script";
import { AlertTriangle, RotateCw } from "lucide-react";
import "./globals.css";

/**
 * Last-resort boundary — only fires when the root layout itself throws, so
 * it has to supply its own <html>/<body> rather than relying on layout.tsx
 * (which may be exactly what's broken). Deliberately minimal: no next/font,
 * no sidebar, nothing that could itself fail — the one job here is to never
 * be the thing that breaks. Still pulls in the theme-init script and
 * globals.css so it isn't a flash of unstyled, wrong-theme content.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive-subtle">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="mt-5 text-section-title text-foreground">ONEVIEW hit a snag</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Something went wrong loading the app itself, not just this page. It&rsquo;s been logged — reloading
            usually fixes it.
          </p>
          {error.digest && <p className="mt-3 text-metadata text-muted-foreground/70">Reference: {error.digest}</p>}

          <button
            onClick={() => reset()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-ui hover:bg-primary/90"
          >
            <RotateCw className="h-4 w-4" />
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
