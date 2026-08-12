"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MasterDataItem {
  id: string;
  name: string;
  isActive: boolean;
}

export function MasterDataSection({
  title,
  description,
  items,
  createAction,
  toggleAction,
}: {
  title: string;
  description: string;
  items: MasterDataItem[];
  createAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  toggleAction: (id: string, isActive: boolean) => Promise<ActionResult>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createAction(formData),
    null
  );
  const [togglePending, startToggle] = useTransition();

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>

      <ul className="mt-4 divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-2 text-sm">
            <span className={item.isActive ? "" : "text-muted-foreground line-through"}>{item.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant={item.isActive ? "success" : "neutral"}>{item.isActive ? "Active" : "Inactive"}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={togglePending}
                onClick={() =>
                  startToggle(async () => {
                    await toggleAction(item.id, !item.isActive);
                  })
                }
              >
                {item.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nothing here yet.</li>}
      </ul>

      <form ref={formRef} action={formAction} className="mt-4 flex gap-2">
        <Input name="name" placeholder="Add new…" required className="flex-1" />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      {fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name[0]}</p>}
      {state && !state.success && !fieldErrors && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
