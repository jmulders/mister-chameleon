"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Sidebar that stays in the page from the lg breakpoint up and becomes an
 * off-canvas drawer below it. A fixed sidebar left 119 of 375 px for the content
 * on a phone. Shared by the /admin and /dashboard layouts.
 */

const SidebarContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function ResponsiveSidebar({
  sidebar,
  children,
}: {
  sidebar:  React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A tapped nav link navigates: the drawer must not stay over the new page.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        />
      )}
      <div
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex transition-[transform,visibility] duration-200",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:transition-none",
          // invisible, not just moved away: a closed drawer stays out of the tab order.
          open ? "translate-x-0" : "invisible -translate-x-full lg:visible",
        )}
      >
        {sidebar}
      </div>
      {children}
    </SidebarContext.Provider>
  );
}

/** Opens the drawer. Only visible below the lg breakpoint. */
export function SidebarMenuButton({ className }: { className?: string }) {
  const ctx = useContext(SidebarContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-label="Open navigation"
      aria-expanded={ctx.open}
      aria-controls="app-sidebar"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5" aria-hidden>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  );
}
