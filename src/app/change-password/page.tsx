import { requireSession } from "@/lib/rbac";
import { logout } from "@/actions/auth.actions";
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-section-title">
                {session.user.mustChangePassword ? "Set a new password" : "Change your password"}
              </h1>
              <p className="mt-1 text-metadata">
                {session.user.mustChangePassword
                  ? "For security, you need to set your own password before continuing."
                  : "You will be signed out and asked to sign in again with your new password."}
              </p>
            </div>
            {/* The proxy forces mustChangePassword users onto this page with
                nowhere else to go — no sidebar, no header, this form or
                nothing. Someone who got here by mistake, is mid-reset via
                email, or just wants to sign in as someone else had no way
                out at all. */}
            <form action={logout} className="shrink-0">
              <button
                type="submit"
                className="text-xs font-medium text-muted-foreground transition-ui hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
