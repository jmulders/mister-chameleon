/**
 * AdminPageHeader
 *
 * One consistent page header for tenant-workspace admin pages: a clear title,
 * an optional lead-in sentence, and an optional right-aligned actions slot.
 *
 * Navigation between workspace sections lives in the TenantSubNav, so pages
 * should NOT add their own "← back" links. Keep the header calm: title,
 * one supporting sentence, and at most one or two primary actions.
 */

import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  /** Small uppercase eyebrow above the title (e.g. the section group). Optional. */
  eyebrow?: string;
  title: string;
  /** One concise supporting sentence. Keep it to a single line of thought. */
  description?: ReactNode;
  /** Optional right-aligned actions (buttons / links styled as buttons). */
  actions?: ReactNode;
}

export function AdminPageHeader({ eyebrow, title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
