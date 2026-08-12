"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** Keys content by the full URL so each navigation (including filter changes) gets a brief, subtle fade-in — never a hard cut, never anything flashy. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div key={`${pathname}?${searchParams.toString()}`} className="animate-in fade-in duration-200">
      {children}
    </div>
  );
}
