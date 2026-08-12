"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/auth.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => changePassword(formData),
    null
  );

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="mt-5 space-y-4">
      {state && !state.success && !fieldErrors && (
        <p role="alert" className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="mt-1" />
        {fieldErrors?.currentPassword && <p className="mt-1 text-xs text-destructive">{fieldErrors.currentPassword[0]}</p>}
      </div>

      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required className="mt-1" />
        {fieldErrors?.newPassword && <p className="mt-1 text-xs text-destructive">{fieldErrors.newPassword[0]}</p>}
        <p className="mt-1 text-metadata">At least 10 characters, with an uppercase letter, a lowercase letter, and a number.</p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="mt-1" />
        {fieldErrors?.confirmPassword && <p className="mt-1 text-xs text-destructive">{fieldErrors.confirmPassword[0]}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
