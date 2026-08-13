import { Suspense } from "react";
import { Sidebar } from "@/components/shared/sidebar";
import { PageTransition } from "@/components/shared/page-transition";

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sidebar-offset min-h-screen bg-surface-sunken pl-[var(--sidebar-w)]">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={children}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </main>
    </div>
  );
}
