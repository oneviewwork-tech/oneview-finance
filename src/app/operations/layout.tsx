import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { PageTransition } from "@/components/shared/page-transition";
import { requireUser, canAccessOperations } from "@/lib/rbac";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!canAccessOperations(user.role)) redirect("/intelligence");

  return (
    <div className="min-h-screen bg-surface-sunken pl-64">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={children}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </main>
    </div>
  );
}
