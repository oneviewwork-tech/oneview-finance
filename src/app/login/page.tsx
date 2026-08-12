import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-foreground">
            O
          </span>
          <span className="text-lg font-semibold tracking-tight">
            ONEVIEW <span className="text-muted-foreground font-medium">Finance</span>
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-section-title">Sign in</h1>
          <p className="mt-1 text-metadata">Accounts and Finance View access.</p>
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-metadata">
          Internal system. Access is limited to authorized ONEVIEW Finance users.
        </p>
      </div>
    </div>
  );
}
