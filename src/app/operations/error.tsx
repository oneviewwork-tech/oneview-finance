"use client";

import { RouteError } from "@/components/shared/route-error";

export default function OperationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} />;
}
