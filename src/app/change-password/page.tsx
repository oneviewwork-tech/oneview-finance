import { requireSession } from "@/lib/rbac";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await requireSession();

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

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-section-title">
            {session.user.mustChangePassword ? "Set a new password" : "Change your password"}
          </h1>
          <p className="mt-1 text-metadata">
            {session.user.mustChangePassword
              ? "For security, you need to set your own password before continuing."
              : "You will be signed out and asked to sign in again with your new password."}
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
