import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/shared/app-header";
import { PageTransition } from "@/components/shared/page-transition";
import { Button } from "@/components/ui/button";

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <AppHeader
        workspace="intelligence"
        actions={
          <Link href="/intelligence/fx">
            <Button variant="outline" size="sm">
              Exchange Rate
            </Button>
          </Link>
        }
      />
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Suspense fallback={children}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </main>
    </div>
  );
}
