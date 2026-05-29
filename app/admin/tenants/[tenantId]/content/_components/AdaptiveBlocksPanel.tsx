/**
 * AdaptiveBlocksPanel
 *
 * Admin UI for managing "Content Matrix" adaptive blocks on the tenant content page.
 * An adaptive block contains one defaultVariant (SEO-safe fallback) and N
 * adaptiveVariants (personalised versions selected by the rule engine).
 *
 * ─── Features ─────────────────────────────────────────────────────────────────
 *
 *   • Block list — all adaptive blocks for this tenant (+ platform-wide)
 *   • Expand to edit — click any block to open its inline editor
 *   • Create new — button to add a new block
 *   • Delete — with confirmation step
 *   • Variant manager — add/remove/edit adaptive variants inline
 *   • Token preview — shows supported {{tokens}} for reference
 *
 * ─── Token reference ──────────────────────────────────────────────────────────
 *
 *   Supported in adaptive variants (NOT in defaultVariant):
 *     {{company_name}}, {{company_short}}, {{location}}, {{city}},
 *     {{region}}, {{industry}}, {{first_name}}, {{source}}
 */

"use client";

import { useState, useTransition, useCallback } from "react";
import type { AdaptiveBlockData, AdaptiveVariantContent, AdaptiveVariantEntry } from "@/cms/types";
import {
  listAdaptiveBlocksAction,
  upsertAdaptiveBlockAction,
  deleteAdaptiveBlockAction,
} from "@/lib/adaptive-blocks/adaptive-blocks-actions";

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls = [
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
].join(" ");

const labelCls = "block text-xs font-medium text-neutral-600 mb-1";

const btnPrimary = [
  "inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5",
  "text-xs font-semibold text-white hover:bg-brand-700 transition-colors",
].join(" ");

const btnSecondary = [
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5",
  "text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors",
].join(" ");

const btnDanger = [
  "inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5",
  "text-xs font-medium text-red-700 hover:bg-red-100 transition-colors",
].join(" ");

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyContent(): AdaptiveVariantContent {
  return { title: "", subtitle: "", tag: "", ctas: [], imageUrl: undefined, imageAlt: undefined };
}

function emptyVariant(): AdaptiveVariantEntry {
  return { variantKey: "", label: "", content: emptyContent() };
}

// ── Variant content form ──────────────────────────────────────────────────────

interface VariantContentFormProps {
  value:       AdaptiveVariantContent;
  onChange:    (v: AdaptiveVariantContent) => void;
  showTokens?: boolean;
  prefix:      string; // for aria/htmlFor uniqueness
}

function VariantContentForm({ value, onChange, showTokens = false, prefix }: VariantContentFormProps) {
  const update = (patch: Partial<AdaptiveVariantContent>) =>
    onChange({ ...value, ...patch });

  const updateCta = (idx: number, field: "label" | "href", val: string) => {
    const ctas = [...(value.ctas ?? [])];
    ctas[idx] = { ...(ctas[idx] ?? { label: "", href: "" }), [field]: val };
    onChange({ ...value, ctas });
  };

  return (
    <div className="space-y-3">

      {showTokens && (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Tokens:</span>{" "}
          {["{{company_name}}", "{{company_short}}", "{{location}}", "{{city}}", "{{region}}", "{{industry}}", "{{first_name}}", "{{source}}"].join(" · ")}
        </div>
      )}

      {!showTokens && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          SEO fallback — do <strong>not</strong> use tokens here.
        </div>
      )}

      <div>
        <label htmlFor={`${prefix}-tag`} className={labelCls}>Eyebrow tag</label>
        <input
          id={`${prefix}-tag`}
          className={inputCls}
          value={value.tag ?? ""}
          onChange={(e) => update({ tag: e.target.value })}
          placeholder={showTokens ? "e.g. For {{industry}} teams" : "e.g. Adaptive websites"}
        />
      </div>

      <div>
        <label htmlFor={`${prefix}-title`} className={labelCls}>Title *</label>
        <input
          id={`${prefix}-title`}
          className={inputCls}
          value={value.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={showTokens ? "e.g. Personalised for {{company_name}}" : "e.g. Your website, tailored"}
          required
        />
      </div>

      <div>
        <label htmlFor={`${prefix}-subtitle`} className={labelCls}>Subtitle *</label>
        <textarea
          id={`${prefix}-subtitle`}
          className={inputCls}
          rows={3}
          value={value.subtitle}
          onChange={(e) => update({ subtitle: e.target.value })}
          placeholder={showTokens ? "Teams at {{company_short}} in {{location}} use us to…" : "Core value proposition…"}
          required
        />
      </div>

      <div className="space-y-2">
        <p className={labelCls}>CTA buttons (max 2)</p>
        {[0, 1].map((idx) => (
          <div key={idx} className="grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              value={value.ctas?.[idx]?.label ?? ""}
              onChange={(e) => updateCta(idx, "label", e.target.value)}
              placeholder={`CTA ${idx + 1} label`}
            />
            <input
              className={inputCls}
              value={value.ctas?.[idx]?.href ?? ""}
              onChange={(e) => updateCta(idx, "href", e.target.value)}
              placeholder={`CTA ${idx + 1} href`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Adaptive variant row editor ───────────────────────────────────────────────

interface VariantRowProps {
  variant:   AdaptiveVariantEntry;
  index:     number;
  onChange:  (v: AdaptiveVariantEntry) => void;
  onRemove:  () => void;
}

function VariantRow({ variant, index, onChange, onRemove }: VariantRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-xs font-mono font-semibold text-neutral-700 truncate">
            {variant.variantKey || `variant-${index + 1}`}
          </span>
          {variant.label && (
            <span className="text-xs text-neutral-400 truncate">{variant.label}</span>
          )}
          <span className="ml-auto shrink-0 text-neutral-400 text-xs">{open ? "▲" : "▼"}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 shrink-0 text-xs text-red-500 hover:text-red-700"
          aria-label="Remove variant"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-200 px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Variant key *</label>
              <input
                className={inputCls}
                value={variant.variantKey}
                onChange={(e) => onChange({ ...variant, variantKey: e.target.value })}
                placeholder="e.g. hero_roi, hero_linkedin_vision"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Label (internal)</label>
              <input
                className={inputCls}
                value={variant.label ?? ""}
                onChange={(e) => onChange({ ...variant, label: e.target.value })}
                placeholder="e.g. LinkedIn / ROI segment"
              />
            </div>
          </div>

          <VariantContentForm
            prefix={`av-${index}`}
            value={variant.content}
            onChange={(content) => onChange({ ...variant, content })}
            showTokens
          />
        </div>
      )}
    </div>
  );
}

// ── Block editor form ─────────────────────────────────────────────────────────

interface BlockEditorProps {
  initial:     AdaptiveBlockData | null; // null = create new
  tenantId:    string;
  onSave:      () => void;
  onCancel:    () => void;
}

function BlockEditor({ initial, tenantId, onSave, onCancel }: BlockEditorProps) {
  const [key,             setKey]             = useState(initial?.key ?? "");
  const [isActive,        setIsActive]        = useState(initial?.isActive ?? true);
  const [defaultVariant,  setDefaultVariant]  = useState<AdaptiveVariantContent>(
    initial?.defaultVariant ?? emptyContent(),
  );
  const [variants,        setVariants]        = useState<AdaptiveVariantEntry[]>(
    initial?.adaptiveVariants ?? [],
  );
  const [error,           setError]           = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  const addVariant = () => setVariants((v) => [...v, emptyVariant()]);
  const removeVariant = (idx: number) => setVariants((v) => v.filter((_, i) => i !== idx));
  const updateVariant = (idx: number, v: AdaptiveVariantEntry) =>
    setVariants((arr) => arr.map((x, i) => (i === idx ? v : x)));

  const handleSave = () => {
    if (!key.trim()) { setError("Block key is required."); return; }
    if (!defaultVariant.title.trim()) { setError("Default variant title is required."); return; }
    if (!defaultVariant.subtitle.trim()) { setError("Default variant subtitle is required."); return; }

    startTransition(async () => {
      const result = await upsertAdaptiveBlockAction(
        {
          id:               initial?.id,
          key:              key.trim(),
          tenantId:         tenantId,
          isActive,
          defaultVariant:   {
            ...defaultVariant,
            ctas: (defaultVariant.ctas ?? []).filter((c) => c.label.trim() && c.href.trim()),
          },
          adaptiveVariants: variants.map((v) => ({
            ...v,
            content: {
              ...v.content,
              ctas: (v.content.ctas ?? []).filter((c) => c.label.trim() && c.href.trim()),
            },
          })),
        },
        `/admin/tenants/${tenantId}/content`,
      );

      if (result.ok) {
        setError(null);
        onSave();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          {initial ? `Edit block: ${initial.key}` : "New adaptive block"}
        </h3>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Active
        </label>
      </div>

      {/* Key */}
      <div>
        <label className={labelCls}>Block key *</label>
        <input
          className={inputCls}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="e.g. hero_matrix_homepage"
          disabled={Boolean(initial)}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Used in <code className="font-mono">getAdaptiveBlock(key)</code> calls. Cannot be changed after creation.
        </p>
      </div>

      {/* Default variant */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-neutral-700">Default variant (SEO fallback)</h4>
        <VariantContentForm
          prefix="dv"
          value={defaultVariant}
          onChange={setDefaultVariant}
          showTokens={false}
        />
      </div>

      {/* Adaptive variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-neutral-700">
            Adaptive variants ({variants.length})
          </h4>
          <button type="button" onClick={addVariant} className={btnSecondary}>
            + Add variant
          </button>
        </div>

        {variants.length === 0 && (
          <p className="text-xs text-neutral-400 py-2">
            No adaptive variants yet. Add a variant to personalise the hero for specific segments.
          </p>
        )}

        {variants.map((v, i) => (
          <VariantRow
            key={i}
            index={i}
            variant={v}
            onChange={(upd) => updateVariant(i, upd)}
            onRemove={() => removeVariant(i)}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
        <button type="button" onClick={handleSave} disabled={isPending} className={btnPrimary}>
          {isPending ? "Saving…" : "Save block"}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Block row ─────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block:      AdaptiveBlockData;
  tenantId:   string;
  onEdited:   () => void;
  onDeleted:  () => void;
}

function BlockRow({ block, tenantId, onEdited, onDeleted }: BlockRowProps) {
  const [editing,    setEditing]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending,  startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAdaptiveBlockAction(
        block.id,
        `/admin/tenants/${tenantId}/content`,
      );
      if (result.ok) { onDeleted(); }
    });
  };

  if (editing) {
    return (
      <BlockEditor
        initial={block}
        tenantId={tenantId}
        onSave={() => { setEditing(false); onEdited(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-neutral-900">{block.key}</span>
            <span className={[
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              block.isActive
                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                : "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
            ].join(" ")}>
              {block.isActive ? "active" : "inactive"}
            </span>
            {block.tenantId === null && (
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 ring-1 ring-brand-200">
                platform
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 truncate">
            {block.defaultVariant.title}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-400">
            {block.adaptiveVariants.length} variant{block.adaptiveVariants.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={btnSecondary}
          >
            Edit
          </button>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={btnDanger}
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-600">Sure?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className={btnDanger}
              >
                {isPending ? "…" : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={btnSecondary}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AdaptiveBlocksPanel ───────────────────────────────────────────────────────

interface AdaptiveBlocksPanelProps {
  tenantId:      string;
  initialBlocks: AdaptiveBlockData[];
}

export function AdaptiveBlocksPanel({ tenantId, initialBlocks }: AdaptiveBlocksPanelProps) {
  const [blocks,   setBlocks]   = useState<AdaptiveBlockData[]>(initialBlocks);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listAdaptiveBlocksAction(tenantId, true);
      if (result.ok) setBlocks(result.blocks);
    });
  }, [tenantId]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Adaptive blocks</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Content Matrix documents — one block, many personalised variants.
            Used by the <code className="font-mono">ChameleonHero</code> component.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={creating || isPending}
          className={btnPrimary}
        >
          + New block
        </button>
      </div>

      {creating && (
        <BlockEditor
          initial={null}
          tenantId={tenantId}
          onSave={() => { setCreating(false); refresh(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {blocks.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-200 px-6 py-8 text-center">
          <p className="text-sm text-neutral-500">No adaptive blocks yet.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Create a block to start personalising your hero section for different visitor segments.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            tenantId={tenantId}
            onEdited={refresh}
            onDeleted={refresh}
          />
        ))}
      </div>
    </section>
  );
}
