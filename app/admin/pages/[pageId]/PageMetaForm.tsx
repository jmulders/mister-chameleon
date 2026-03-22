/**
 * PageMetaForm — editable title and slug fields (PB3)
 *
 * Client component — manages local state and calls the savePageMetaAction
 * server action via useTransition so the form stays responsive while the
 * write is in flight.
 *
 * Scope (PB3): title + slug only.
 * Block editing → PB4.  Context slot editing → PB5.
 */

"use client";

import { useState, useTransition } from "react";
import { savePageMetaAction }      from "./actions";
import type { ActionResult }       from "./actions";

// ── Field helpers ──────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wider text-neutral-500"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  prefix,
}: {
  id:          string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  disabled?:   boolean;
  prefix?:     string;
}) {
  return (
    <div className="flex items-center rounded-md border border-neutral-300 bg-white focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
      {prefix && (
        <span className="select-none border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400 rounded-l-md">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

// ── Status banner ──────────────────────────────────────────────────────────────

function StatusBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        result.ok
          ? "rounded-md bg-success-50 border border-success-200 px-4 py-2.5 text-sm text-success-700"
          : "rounded-md bg-error-50 border border-error-200 px-4 py-2.5 text-sm text-error-700"
      }
    >
      {result.ok ? "Changes saved." : (result.error ?? "Save failed — please try again.")}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface PageMetaFormProps {
  pageId:        string;
  initialTitle:  string;
  initialSlug:   string;
  /**
   * Optional override for the save action.  When provided this function is
   * called instead of the default `savePageMetaAction`.  Pass a bound server
   * action from a tenant-scoped parent route to keep saving within the correct
   * tenant context.
   *
   * Signature matches savePageMetaAction: (title, slug) => Promise<ActionResult>
   */
  onSave?: (title: string, slug: string) => Promise<ActionResult>;
}

export function PageMetaForm({ pageId, initialTitle, initialSlug, onSave }: PageMetaFormProps) {
  const [title,  setTitle]  = useState(initialTitle);
  const [slug,   setSlug]   = useState(initialSlug);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = title !== initialTitle || slug !== initialSlug;

  function handleChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setResult(null); // clear status on any edit
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      // Use the injected onSave if provided (tenant-scoped route); fall back to
      // the default global action for the legacy /admin/pages/[pageId] route.
      const res = onSave
        ? await onSave(title, slug)
        : await savePageMetaAction(pageId, title, slug);
      setResult(res);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="page-title">Title</FieldLabel>
        <TextInput
          id="page-title"
          value={title}
          onChange={handleChange(setTitle)}
          placeholder="Page title"
          disabled={isPending}
        />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="page-slug">Slug</FieldLabel>
        <TextInput
          id="page-slug"
          value={slug}
          onChange={handleChange(setSlug)}
          placeholder="page-slug"
          prefix="/"
          disabled={isPending}
        />
        <p className="text-xs text-neutral-400">
          URL path without the leading slash. Use lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {/* Status + submit */}
      <div className="flex flex-col gap-3">
        <StatusBanner result={result} />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !isDirty}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <span className="mr-2 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>

          {isDirty && !isPending && (
            <span className="text-xs text-neutral-400">Unsaved changes</span>
          )}
        </div>
      </div>
    </form>
  );
}
