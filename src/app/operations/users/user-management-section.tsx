"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { UserRole } from "@prisma/client";
import { createUser, resetUserPassword, setUserActive, setUserRole } from "@/actions/user.actions";
import type { ActionResult } from "@/lib/action-result";
import { ROLE_OPTIONS, ROLE_LABEL } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastActiveAt: Date | null;
}

export function UserManagementSection({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  return (
    <div className="space-y-6">
      <CreateUserForm />
      <div className="rounded-xl border border-border">
        <ul className="divide-y divide-border">
          {users.map((user) => (
            <UserRowItem key={user.id} user={user} isSelf={user.id === currentUserId} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CreateUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createUser(formData),
    null
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-semibold">Add a user</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Set a temporary password — the user must change it the first time they sign in.
      </p>

      <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required className="mt-1" />
          {fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name[0]}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" />
          {fieldErrors?.email && <p className="mt-1 text-xs text-destructive">{fieldErrors.email[0]}</p>}
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" defaultValue="MANAGEMENT_VIEWER" className="mt-1">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="temporaryPassword">Temporary password</Label>
          <Input id="temporaryPassword" name="temporaryPassword" type="text" required className="mt-1" />
          {fieldErrors?.temporaryPassword && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.temporaryPassword[0]}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Creating…" : "Create user"}
          </Button>
          {state && !state.success && !fieldErrors && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
        </div>
      </form>
    </div>
  );
}

function UserRowItem({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {user.name} {isSelf && <span className="text-muted-foreground">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={user.role}
            disabled={isSelf || pending}
            onChange={(e) => {
              const formData = new FormData();
              formData.set("role", e.target.value);
              startTransition(async () => {
                await setUserRole(user.id, formData);
              });
            }}
            className="h-8 w-40 text-xs"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>

          <Badge variant={user.isActive ? "success" : "neutral"}>{user.isActive ? "Active" : "Inactive"}</Badge>
          {user.mustChangePassword && <Badge variant="warning">Password reset pending</Badge>}

          <Button type="button" variant="ghost" size="sm" onClick={() => setShowReset((v) => !v)}>
            Reset password
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSelf || pending}
            onClick={() =>
              startTransition(async () => {
                await setUserActive(user.id, !user.isActive);
              })
            }
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>

      {user.lastActiveAt && (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">Last active {formatDate(user.lastActiveAt)}</p>
      )}

      {showReset && <ResetPasswordForm userId={user.id} onDone={() => setShowReset(false)} />}
    </li>
  );
}

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex items-center gap-2"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await resetUserPassword(userId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          onDone();
        });
      }}
    >
      <Input name="temporaryPassword" placeholder="New temporary password" required className="h-8 max-w-xs text-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
