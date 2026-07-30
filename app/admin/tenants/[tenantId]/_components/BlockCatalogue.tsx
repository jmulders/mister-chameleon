"use client";

/**
 * BlockCatalogue
 *
 * Visual catalogue of context and content blocks for the Allowed Blocks
 * section of the tenant settings form.
 *
 * ─── What it replaces ─────────────────────────────────────────────────────────
 *
 *   The raw checkbox list in TenantSettingsForm's Blocks section, which showed
 *   only technical key names and a locked-state badge.
 *
 * ─── What it adds ─────────────────────────────────────────────────────────────
 *
 *   • Human-readable block name and short description from block-catalogue.ts
 *   • Enable / disable toggle (same functional contract as the old checkbox)
 *   • Package-locked badge and muted styling when block is not in current plan
 *   • Expandable variants list (how many visual layouts exist for this block)
 *   • Deep-link to the Storybook autodocs page when a story exists
 *   • Category grouping for the content blocks section
 *   • Separate context-blocks section with explanation of adaptive slots
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   pkgAllowedContext  — which context blocks the current package permits
 *   pkgAllowedContent  — which content blocks the current package permits
 *   enabledContext     — currently enabled context blocks (form state)
 *   enabledContent     — currently enabled content blocks (form state)
 *   onContextToggle    — called when a context block is toggled
 *   onContentToggle    — called when a content block is toggled
 *   contentBlockHints  — package-requirement text per block key (e.g. "Pro only")
 *   storybookBaseUrl   — Storybook origin; defaults to http://localhost:6006
 */

import { useState }               from "react";
import { cn }                     from "@/lib/utils";
import { Badge }                  from "@/components/ui/Badge";
import type { ContentBlockKey, ContextBlockKey } from "@/tenant";
import {
  getAllBlockDefinitions,
  getBlockDefinition,
} from "@/page-config/registry";
import type { BlockDefinition }   from "@/page-config";
import {
  CONTEXT_BLOCK_CATALOGUE,
  getBlockCatalogueEntry,
  buildStorybookUrl,
} from "@/page-config/block-catalogue";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BlockCatalogueProps {
  pkgAllowedContext:  readonly ContextBlockKey[];
  pkgAllowedContent:  readonly ContentBlockKey[];
  enabledContext:     readonly ContextBlockKey[];
  enabledContent:     readonly ContentBlockKey[];
  onContextToggle:    (key: ContextBlockKey, enabled: boolean) => void;
  onContentToggle:    (key: ContentBlockKey, enabled: boolean) => void;
  /** Package-requirement text per content block — e.g. "Pro only", "Growth or Pro". */
  contentBlockHints:  Partial<Record<ContentBlockKey, string>>;
  /** Base URL for Storybook deep-links. Defaults to http://localhost:6006. */
  storybookBaseUrl?:  string;
}

// ── Category metadata ─────────────────────────────────────────────────────────

type BlockCategoryKey = "text" | "media" | "social-proof" | "features" | "content" | "conversion";

const CATEGORY_META: Record<BlockCategoryKey, {
  label:      string;
  borderCls:  string;
  headerCls:  string;
  iconBgCls:  string;
  icon:       string;
}> = {
  text: {
    label:     "Text",
    borderCls: "border-blue-200",
    headerCls: "text-blue-600",
    iconBgCls: "bg-blue-50 text-blue-500",
    icon:      "T",
  },
  media: {
    label:     "Media",
    borderCls: "border-purple-200",
    headerCls: "text-purple-600",
    iconBgCls: "bg-purple-50 text-purple-500",
    icon:      "▶",
  },
  "social-proof": {
    label:     "Social proof",
    borderCls: "border-amber-200",
    headerCls: "text-amber-600",
    iconBgCls: "bg-amber-50 text-amber-500",
    icon:      "★",
  },
  features: {
    label:     "Features",
    borderCls: "border-emerald-200",
    headerCls: "text-emerald-600",
    iconBgCls: "bg-emerald-50 text-emerald-500",
    icon:      "⊞",
  },
  content: {
    label:     "Content",
    borderCls: "border-slate-200",
    headerCls: "text-slate-600",
    iconBgCls: "bg-slate-50 text-slate-500",
    icon:      "≡",
  },
  conversion: {
    label:     "Conversion",
    borderCls: "border-rose-200",
    headerCls: "text-rose-600",
    iconBgCls: "bg-rose-50 text-rose-500",
    icon:      "→",
  },
};

// ── Inline Toggle ─────────────────────────────────────────────────────────────

function BlockToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked:  boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label:    string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${checked ? "Disable" : "Enable"} ${label}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
        checked ? "bg-brand-600" : "bg-neutral-200",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm",
          "transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

// ── VariantsPanel ─────────────────────────────────────────────────────────────

function VariantsPanel({ variants }: { variants: readonly string[] }) {
  const [open, setOpen] = useState(false);

  if (variants.length === 0) return null;

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <span
          className={cn(
            "inline-block text-[9px] transition-transform duration-150",
            open ? "rotate-90" : "rotate-0",
          )}
        >
          ▶
        </span>
        {variants.length} variant{variants.length !== 1 ? "s" : ""}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {variants.map((v) => (
            <span
              key={v}
              className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500"
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ContentBlockCard ──────────────────────────────────────────────────────────

function ContentBlockCard({
  def,
  pkgAllowed,
  checked,
  hint,
  onToggle,
  storybookBaseUrl,
}: {
  def:              BlockDefinition;
  pkgAllowed:       boolean;
  checked:          boolean;
  hint:             string;
  onToggle:         (enabled: boolean) => void;
  storybookBaseUrl: string;
}) {
  const catalogueEntry = getBlockCatalogueEntry(def.key as ContentBlockKey);
  const storybookUrl   = buildStorybookUrl(def.key as ContentBlockKey, storybookBaseUrl);
  const catMeta        = CATEGORY_META[def.category as BlockCategoryKey];

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-white px-4 py-3 transition-opacity",
        catMeta ? catMeta.borderCls : "border-neutral-200",
        !pkgAllowed && "opacity-60",
      )}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {catMeta && (
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold select-none",
                catMeta.iconBgCls,
              )}
              aria-hidden
            >
              {catMeta.icon}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-neutral-800">
            {def.displayName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!pkgAllowed && hint && (
            <Badge variant="outline" size="sm">
              {hint}
            </Badge>
          )}
          <BlockToggle
            checked={checked}
            disabled={!pkgAllowed}
            onChange={onToggle}
            label={def.displayName}
          />
        </div>
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
        {catalogueEntry.description}
      </p>

      {/* ── Footer: variants + Storybook link ──────────────────────────── */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {def.allowedVariants && def.allowedVariants.length > 0 ? (
            <VariantsPanel variants={def.allowedVariants} />
          ) : (
            <span className="text-xs text-neutral-300">No variants</span>
          )}
        </div>

        {storybookUrl && (
          <a
            href={storybookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            title={`Open ${def.displayName} in Storybook`}
          >
            Storybook
            <svg
              className="h-2.5 w-2.5"
              fill="none"
              viewBox="0 0 10 10"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1.5 8.5 8.5 1.5M4.5 1.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── ContextBlockCard ──────────────────────────────────────────────────────────

function ContextBlockCard({
  entry,
  pkgAllowed,
  checked,
  onToggle,
}: {
  entry:      typeof CONTEXT_BLOCK_CATALOGUE[number];
  pkgAllowed: boolean;
  checked:    boolean;
  onToggle:   (enabled: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-brand-200 bg-white px-4 py-3 transition-opacity",
        !pkgAllowed && "opacity-60",
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-50 text-[11px] font-bold text-brand-400 select-none"
            aria-hidden
          >
            ⚡
          </span>
          <span className="truncate text-sm font-semibold text-neutral-800">
            {entry.displayName}
          </span>
        </div>

        <BlockToggle
          checked={checked}
          disabled={!pkgAllowed}
          onChange={onToggle}
          label={entry.displayName}
        />
      </div>

      {/* ── Description ────────────────────────────────────────────────── */}
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
        {entry.description}
      </p>

      {/* ── Footer label ────────────────────────────────────────────────── */}
      <div className="mt-2 border-t border-neutral-100 pt-2">
        <span className="text-[11px] font-medium text-brand-400">
          Adaptive slot, variant chosen at runtime
        </span>
      </div>
    </div>
  );
}

// ── CategoryGroup ─────────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  blocks,
  pkgAllowedContent,
  enabledContent,
  onContentToggle,
  contentBlockHints,
  storybookBaseUrl,
}: {
  category:          BlockCategoryKey;
  blocks:            BlockDefinition[];
  pkgAllowedContent: readonly ContentBlockKey[];
  enabledContent:    readonly ContentBlockKey[];
  onContentToggle:   (key: ContentBlockKey, enabled: boolean) => void;
  contentBlockHints: Partial<Record<ContentBlockKey, string>>;
  storybookBaseUrl:  string;
}) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;

  return (
    <div>
      {/* Category header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold select-none",
            meta.iconBgCls,
          )}
          aria-hidden
        >
          {meta.icon}
        </span>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider",
            meta.headerCls,
          )}
        >
          {meta.label}
        </p>
        <span className="text-[11px] text-neutral-300">
          {blocks.length} block{blocks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Block cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {blocks.map((def) => {
          const key       = def.key as ContentBlockKey;
          const pkgOk     = pkgAllowedContent.includes(key);
          const isChecked = enabledContent.includes(key);
          const hint      = contentBlockHints[key] ?? "";

          return (
            <ContentBlockCard
              key={key}
              def={def}
              pkgAllowed={pkgOk}
              checked={isChecked}
              hint={hint}
              onToggle={(v) => onContentToggle(key, v)}
              storybookBaseUrl={storybookBaseUrl}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── BlockCatalogue (main export) ──────────────────────────────────────────────

export function BlockCatalogue({
  pkgAllowedContext,
  pkgAllowedContent,
  enabledContext,
  enabledContent,
  onContextToggle,
  onContentToggle,
  contentBlockHints,
  storybookBaseUrl = "http://localhost:6006",
}: BlockCatalogueProps) {

  // ── Derive content blocks grouped by category ─────────────────────────────
  //
  // Pull the full ordered list from the registry, exclude internal-only
  // searchResults, then group into category buckets for rendering.

  const allDefs = getAllBlockDefinitions();

  const byCategory = allDefs.reduce<Partial<Record<BlockCategoryKey, BlockDefinition[]>>>(
    (acc, def) => {
      if (def.key === "searchResults") return acc; // internal — never user-selectable
      const cat = def.category as BlockCategoryKey;
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(def);
      return acc;
    },
    {},
  );

  const categoryOrder: BlockCategoryKey[] = [
    "text", "media", "social-proof", "features", "content", "conversion",
  ];

  // ── Context blocks ────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Context blocks (adaptive slots) ─────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-800">
            Context blocks
            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-600">
              Adaptive slots
            </span>
          </h3>
          <p className="mt-1 text-xs text-neutral-500 max-w-xl">
            These are adaptive personalisation slots, not CMS content sections.
            The rules engine (or AI layer) selects the best variant for each visitor
            at request time.  Editors create the variants in the CMS; the platform
            decides which one to show.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTEXT_BLOCK_CATALOGUE.map((entry) => {
            const pkgOk = pkgAllowedContext.includes(entry.key);
            const isOn  = enabledContext.includes(entry.key);
            return (
              <ContextBlockCard
                key={entry.key}
                entry={entry}
                pkgAllowed={pkgOk}
                checked={isOn}
                onToggle={(v) => onContextToggle(entry.key, v)}
              />
            );
          })}
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <hr className="border-neutral-100" />

      {/* ── Content blocks ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-neutral-800">
            Content blocks
            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              CMS sections
            </span>
          </h3>
          <p className="mt-1 text-xs text-neutral-500 max-w-xl">
            Blocks editors can place on CMS pages.  Only enabled blocks are
            renderable. Disabling a block here also prevents it rendering even if
            it exists in the CMS.  Blocks grayed out require an upgraded plan.
          </p>
        </div>

        <div className="space-y-7">
          {categoryOrder.map((cat) => {
            const blocks = byCategory[cat];
            if (!blocks || blocks.length === 0) return null;
            return (
              <CategoryGroup
                key={cat}
                category={cat}
                blocks={blocks}
                pkgAllowedContent={pkgAllowedContent}
                enabledContent={enabledContent}
                onContentToggle={onContentToggle}
                contentBlockHints={contentBlockHints}
                storybookBaseUrl={storybookBaseUrl}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
