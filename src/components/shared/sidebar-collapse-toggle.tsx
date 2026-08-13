"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oneview-sidebar";

/**
 * Collapses the sidebar to icons only, widening the working area.
 *
 * The state is written to <html data-sidebar> rather than kept in React,
 * because the page content's left padding has to move with it and that
 * padding is applied by server-rendered layouts. theme-init.js applies the
 * stored value before first paint so the sidebar doesn't visibly jump on
 * every navigation.
 */
export function SidebarCollapseToggle({ collapsed, onChange }: { collapsed: boolean; onChange: (v: boolean) => void }) {
  // Read once on mount: the server can't know the stored preference, so the
  // first client render has to reconcile with what theme-init.js already did.
  useEffect(() => {
    onChange(document.documentElement.getAttribute("data-sidebar") === "collapsed");
    // Intentionally mount-only — this syncs to the DOM the init script set,
    // and re-running it on every onChange identity change would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !collapsed;
    onChange(next);
    const root = document.documentElement;
    if (next) root.setAttribute("data-sidebar", "collapsed");
    else root.removeAttribute("data-sidebar");
    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Private browsing with storage denied — the toggle still works for
      // this session, it just won't be remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-ui",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);
  return [collapsed, setCollapsed];
}
