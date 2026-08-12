import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutDashboard, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessOperations } from "@/domain/access/permissions";
import { BrandLogo } from "@/components/shared/brand-logo";

// Workspace chooser — only ever seen by a signed-in user. Unauthenticated
// visitors are sent to /login (also enforced centrally in proxy.ts, this is
// the same defense-in-depth pattern the rest of the app uses).
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, name, email } = session.user;
  const showAccounts = canAccessOperations(role);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-3">
          <BrandLogo size="lg" className="text-foreground" />
          <span className="h-5 w-px bg-border" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Finance
          </span>
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-page-title">Welcome back{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-page-subtitle">
            {showAccounts
              ? "Accounts for entering data, Finance View for management."
              : "Your management dashboards and analytics."}
          </p>
        </div>

        <div className={`mt-8 grid gap-4 ${showAccounts ? "sm:grid-cols-2" : "max-w-sm mx-auto"}`}>
          <WorkspaceCard
            href="/intelligence"
            icon={<LayoutDashboard className="h-5 w-5" />}
            title="Finance View"
            description="Dashboards, KPIs, cash flow, receivables — UAE, India and Combined."
          />
          {showAccounts && (
            <WorkspaceCard
              href="/operations"
              icon={<Wallet className="h-5 w-5" />}
              title="Accounts"
              description="Enter and manage inflows, expenses, payments, clients and vendors."
            />
          )}
        </div>

        <p className="mt-8 text-center text-metadata">Signed in as {email}</p>
      </div>
    </main>
  );
}

function WorkspaceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-ui hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">{icon}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <h2 className="mt-4 text-section-title">{title}</h2>
      <p className="mt-1 text-metadata">{description}</p>
    </Link>
  );
}
