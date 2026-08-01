/**
 * NewPageForm — Preset picker + page identity form (client component)
 *
 * Renders:
 *   1. A grid of preset cards — one per registered preset.
 *      Clicking a card selects it (radio-like behaviour).
 *   2. Title input — required, drives slug auto-generation.
 *   3. Slug input — normalised URL slug; auto-derived from title until the
 *      operator explicitly edits it.
 *   4. Submit button — calls the bound createPageFromPresetAction and
 *      navigates to the new page's editor on success.
 */

"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter }                        from "next/navigation";
import type { PagePreset }                  from "@/page-config";
import type { CreatePageResult }            from "./actions";

// ── Template badge labels ─────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  "marketing-page": "Marketing",
  "landing-page":   "Landing",
  "article-page":   "Article",
  "listing-page":   "Listing",
  "detail-page":    "Detail",
};

const TEMPLATE_COLOR: Record<string, string> = {
  "marketing-page": "bg-brand-100 text-brand-700",
  "landing-page":   "bg-success-100 text-success-700",
  "article-page":   "bg-neutral-100 text-neutral-600",
  "listing-page":   "bg-amber-100 text-amber-700",
  "detail-page":    "bg-neutral-100 text-neutral-500",
};

// ── Slug helpers ──────────────────────────────────────────────────────────────

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

// ── Field label ───────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface NewPageFormProps {
  presets:  readonly PagePreset[];
  tenantId: string;
  onSubmit: (formData: FormData) => Promise<CreatePageResult>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewPageForm({ presets, tenantId, onSubmit }: NewPageFormProps) {
  const router = useRouter();

  const [selectedKey,  setSelectedKey]  = useState<string>(presets[0]?.key ?? "");
  const [title,        setTitle]        = useState("");
  const [slug,         setSlug]         = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();
  const slugEdited = useRef(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    if (!slugEdited.current) {
      setSlug(titleToSlug(val));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugEdited.current = true;
    setSlug(e.target.value);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedKey) { setError("Please select a preset."); return; }
    if (!title.trim()) { setError("Page title is required."); return; }
    if (!slug.trim())  { setError("Page slug is required."); return; }
    setError(null);

    const formData = new FormData();
    formData.set("presetKey", selectedKey);
    formData.set("title",     title.trim());
    formData.set("slug",      slug.trim());

    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result.ok && result.pageId) {
        router.push(`/admin/tenants/${tenantId}/content/pages/${result.pageId}`);
      } else {
        setError(result.error ?? "Failed to create page. Please try again.");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">

      {/* ── 1. Preset picker ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-neutral-800">
          Choose a starting point
        </h2>
        <p className="mb-4 text-xs text-neutral-400">
          Pick the preset that best matches this page type. You can add, remove,
          and reorder blocks after the page is created.
        </p>

        <div
          role="radiogroup"
          aria-label="Page preset"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {presets.map((preset) => {
            const isSelected = selectedKey === preset.key;
            const templateLabel = TEMPLATE_LABEL[preset.templateKey] ?? preset.templateKey;
            const templateColor = TEMPLATE_COLOR[preset.templateKey] ?? "bg-neutral-100 text-neutral-600";
            const blockCount    = preset.blocks.length;

            return (
              <button
                key={preset.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedKey(preset.key)}
                className={[
                  "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-brand-400",
                  isSelected
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
                ].join(" ")}
              >
                {/* Template badge */}
                <span
                  className={[
                    "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    templateColor,
                  ].join(" ")}
                >
                  {templateLabel}
                </span>

                {/* Preset label */}
                <span className="text-sm font-semibold text-neutral-900 leading-tight">
                  {preset.label}
                </span>

                {/* Description */}
                <span className="text-xs text-neutral-500 leading-snug">
                  {preset.description}
                </span>

                {/* Block count pill */}
                <span className="mt-auto inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                  {blockCount} block{blockCount !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 2. Page identity ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">Page details</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="new-page-title">Page title</FieldLabel>
            <input
              id="new-page-title"
              type="text"
              name="title"
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. About us"
              required
              autoFocus
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-xs text-neutral-400">
              Internal page title, also used as the default SEO title.
            </p>
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="new-page-slug">URL slug</FieldLabel>
            <div className="flex items-center rounded-md border border-neutral-300 bg-neutral-50 overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
              <span className="select-none px-2 py-2 text-sm text-neutral-400 font-mono border-r border-neutral-200">
                /
              </span>
              <input
                id="new-page-slug"
                type="text"
                name="slug"
                value={slug}
                onChange={handleSlugChange}
                placeholder="about-us"
                required
                className="flex-1 bg-white px-3 py-2 font-mono text-sm text-neutral-900 outline-none"
              />
            </div>
            <p className="text-xs text-neutral-400">
              Lowercase letters, numbers, and hyphens only. Auto-generated from
              the title. Edit to customise.
            </p>
          </div>
        </div>
      </section>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending || !selectedKey}
          className="inline-flex h-9 items-center justify-center rounded-md bg-brand-500 px-5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="mr-2 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating…
            </>
          ) : (
            "Create page"
          )}
        </button>

        <span className="text-xs text-neutral-400">
          {selectedKey
            ? <>Using preset: <span className="font-medium text-neutral-600">{presets.find((p) => p.key === selectedKey)?.label ?? selectedKey}</span></>
            : "Select a preset above"}
        </span>
      </div>

    </form>
  );
}
