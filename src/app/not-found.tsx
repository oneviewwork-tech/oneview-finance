import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Root not-found — catches every notFound() call and every unmatched route
 *  app-wide, same branded treatment as error.tsx rather than Next's default. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <SearchX className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="mt-5 text-section-title text-foreground">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <Link href="/intelligence" className="mt-6">
        <Button>Go to Finance View</Button>
      </Link>
    </div>
  );
}
