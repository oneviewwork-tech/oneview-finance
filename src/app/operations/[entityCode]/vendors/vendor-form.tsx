"use client";

import { useActionState, useEffect, useRef } from "react";
import { createVendor } from "@/actions/vendor.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VendorForm({ entityId }: { entityId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createVendor(formData),
    null
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-3 rounded-xl border border-border p-4">
      <input type="hidden" name="entityId" value={entityId} />
      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
      )}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required className="mt-1" />
        {fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name[0]}</p>}
      </div>
      <div>
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" className="mt-1" />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Add vendor"}
      </Button>
    </form>
  );
}
