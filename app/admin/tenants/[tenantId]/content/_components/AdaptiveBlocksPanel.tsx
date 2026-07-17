/**
 * AdaptiveBlocksPanel — Tenant-level adaptive blocks manager
 *
 * Shows every platform-wide adaptive block organised by slot type.  For each
 * block the panel shows:
 *
 *   • Platform source row (title/subtitle/variant count preview)
 *   • Tenant activation status — "platform default" / "tenant active" / "disabled"
 *   • Toggle active/inactive for this tenant (activateBlockForTenantAction)
 *   • Customise — opens inline editor to create/edit a tenant-specific override
 *   • Revert to platform — deletes the tenant override row
 *   • Content preview cards for default + adaptive variants
 *
 * Slot navigation is via tab buttons at the top (hero, proof, cta, feature,
 * conversion, notification).
 *
 * ─── Token reference ──────────────────────────────────────────────────────────
 *   Supported in adaptive variants (NOT in defaultVariant):
 *   {{company_name}}, {{company_short}}, {{location}}, {{city}},
 *   {{region}}, {{industry}}, {{first_name}}, {{source}}
 */

"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import type { AdaptiveBlockData, AdaptiveVariantContent, AdaptiveVariantEntry } from "@/cms/types";
import { ADAPTIVE_SLOT_REGISTRY } from "@/decision/types";
import {
  listAdaptiveBlocksAction,
  upsertAdaptiveBlockAction,
  deleteAdaptiveBlockAction,
  activateBlockForTenantAction,
} from "@/lib/adaptive-blocks/adaptive-blocks-actions";

// ── Style tokens ──────────────────────────────────────────────────────────────

const inputCls = [
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
].join(" ");

const labelCls = "block text-xs font-medium text-neutral-600 mb-1";

const btnPrimary = [
  "inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5",
  "text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50",
].join(" ");

const btnSecondary = [
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5",
  "text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50",
].join(" ");

const btnDanger = [
  "inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5",
  "text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50",
].join(" ");

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyContent(): AdaptiveVariantContent {
  return { title: "", subtitle: "", tag: "", ctas: [], imageUrl: undefined, imageAlt: undefined };
}
function emptyVariant(): AdaptiveVariantEntry {
  return { variantKey: "", label: "", content: emptyContent() };
}
function preview(text: string | undefined | null, max = 80): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Given a slot's known blocks + all blocks loaded for this tenant, return the
 *  de-duplicated key list that should appear in this slot's section.
 *  We show every key that has at least one row (platform or tenant).
 */
function slotBlockPairs(
  keyPrefix: string,
  blocks:    AdaptiveBlockData[],
  tenantId:  string,
): Array<{ key: string; platform: AdaptiveBlockData | null; tenant: AdaptiveBlockData | null }> {
  const slotBlocks = blocks.filter((b) => b.key.startsWith(keyPrefix));

  // Build map: key → { platform, tenant }
  const byKey = new Map<
    string,
    { platform: AdaptiveBlockData | null; tenant: AdaptiveBlockData | null }
  >();

  for (const b of slotBlocks) {
    const entry = byKey.get(b.key) ?? { platform: null, tenant: null };
    if (b.tenantId === null) entry.platform = b;
    else if (b.tenantId === tenantId) entry.tenant = b;
    byKey.set(b.key, entry);
  }

  return Array.from(byKey.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pair]) => ({ key, ...pair }));
}

// ── VariantContentForm ────────────────────────────────────────────────────────

interface VariantContentFormProps {
  value:       AdaptiveVariantContent;
  onChange:    (v: AdaptiveVariantContent) => void;
  showTokens?: boolean;
  prefix:      string;
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
      {showTokens ? (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Tokens:</span>{" "}
          {["{{company_name}}", "{{company_short}}", "{{location}}", "{{city}}", "{{region}}", "{{industry}}", "{{first_name}}", "{{source}}"].join(" · ")}
        </div>
      ) : (
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

// ── VariantRow ────────────────────────────────────────────────────────────────

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
          <code className="text-xs font-mono font-semibold text-brand-700 truncate">
            {variant.variantKey || `variant-${index + 1}`}
          </code>
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
                placeholder="e.g. hero_roi"
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

// ── BlockEditor ───────────────────────────────────────────────────────────────

interface BlockEditorProps {
  initial:     AdaptiveBlockData | null;
  tenantId:    string;
  prefillKey?: string;
  onSave:      () => void;
  onCancel:    () => void;
}

function BlockEditor({ initial, tenantId, prefillKey, onSave, onCancel }: BlockEditorProps) {
  const [key,            setKey]            = useState(initial?.key ?? prefillKey ?? "");
  const [isActive,       setIsActive]       = useState(initial?.isActive ?? true);
  const [defaultVariant, setDefaultVariant] = useState<AdaptiveVariantContent>(
    initial?.defaultVariant ?? emptyContent(),
  );
  const [variants,       setVariants]       = useState<AdaptiveVariantEntry[]>(
    initial?.adaptiveVariants ?? [],
  );
  const [error,          setError]          = useState<string | null>(null);
  const [isPending,      startTransition]   = useTransition();

  const addVariant  = () => setVariants((v) => [...v, emptyVariant()]);
  const removeVariant = (idx: number) => setVariants((v) => v.filter((_, i) => i !== idx));
  const updateVariant = (idx: number, v: AdaptiveVariantEntry) =>
    setVariants((arr) => arr.map((x, i) => (i === idx ? v : x)));

  const handleSave = () => {
    if (!key.trim())                    { setError("Block key is required."); return; }
    if (!defaultVariant.title.trim())   { setError("Default variant title is required."); return; }
    if (!defaultVariant.subtitle.trim()){ setError("Default variant subtitle is required."); return; }

    startTransition(async () => {
      const result = await upsertAdaptiveBlockAction(
        {
          id:               initial?.id,
          key:              key.trim(),
          tenantId,
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

      if (result.ok) { setError(null); onSave(); }
      else            { setError(result.error); }
    });
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-5 space-y-6 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          {initial ? `Edit override: ${initial.key}` : "New tenant block"}
        </h3>
        <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Active for this tenant
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
          Used in <code className="font-mono">getAdaptiveBlock(key)</code>. Cannot change after creation.
        </p>
      </div>

      {/* Default variant */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
          Default variant (SEO fallback)
        </h4>
        <VariantContentForm prefix="dv" value={defaultVariant} onChange={setDefaultVariant} showTokens={false} />
      </div>

      {/* Adaptive variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
            Adaptive variants ({variants.length})
          </h4>
          <button type="button" onClick={addVariant} className={btnSecondary}>
            + Add variant
          </button>
        </div>

        {variants.length === 0 && (
          <p className="text-xs text-neutral-400 py-2 italic">
            No adaptive variants yet — add a variant to personalise this block for specific segments.
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

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

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

// ── VariantPreviewCard ────────────────────────────────────────────────────────

function VariantPreviewCard({
  content,
  variantKey,
  label,
}: {
  content:     AdaptiveVariantContent;
  variantKey?: string;
  label?:      string | null;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 space-y-1">
      {variantKey && (
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
            {variantKey}
          </code>
          {label && <span className="text-[10px] text-neutral-400">{label}</span>}
        </div>
      )}
      <div className="space-y-0.5">
        {content.tag && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {content.tag}
          </p>
        )}
        <p className="text-xs font-semibold text-neutral-800 leading-snug">
          {preview(content.title, 80)}
        </p>
        {content.subtitle && (
          <p className="text-[11px] text-neutral-500 leading-snug">
            {preview(content.subtitle, 100)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── BlockStatusCard ───────────────────────────────────────────────────────────

interface BlockStatusCardProps {
  blockKey:   string;
  platform:   AdaptiveBlockData | null;
  tenant:     AdaptiveBlockData | null;
  tenantId:   string;
  slotPrefix: string;
  onRefresh:  () => void;
}

function BlockStatusCard({
  blockKey, platform, tenant, tenantId, slotPrefix, onRefresh,
}: BlockStatusCardProps) {
  const [editing,    setEditing]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [isPending,  startTransition] = useTransition();

  // The "effective" block — tenant override takes precedence, else platform
  const effective = tenant ?? platform;

  // Determine display status
  const statusLabel = tenant
    ? tenant.isActive
      ? "Tenant active"
      : "Tenant disabled"
    : platform?.isActive
      ? "Platform default"
      : "Platform inactive";

  const statusCls = tenant
    ? tenant.isActive
      ? "bg-green-50 text-green-700 ring-green-200"
      : "bg-red-50 text-red-700 ring-red-200"
    : platform?.isActive
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : "bg-neutral-100 text-neutral-500 ring-neutral-200";

  // Toggle active (creates/updates tenant row)
  const handleToggleActive = (nextActive: boolean) => {
    startTransition(async () => {
      await activateBlockForTenantAction(
        blockKey,
        tenantId,
        nextActive,
        `/admin/tenants/${tenantId}/content`,
      );
      onRefresh();
    });
  };

  // Revert to platform (delete tenant row)
  const handleRevert = () => {
    if (!tenant) return;
    startTransition(async () => {
      await deleteAdaptiveBlockAction(tenant.id, `/admin/tenants/${tenantId}/content`);
      setConfirming(false);
      onRefresh();
    });
  };

  if (editing && effective) {
    return (
      <BlockEditor
        initial={tenant ?? { ...platform!, id: "", tenantId }}
        tenantId={tenantId}
        onSave={() => { setEditing(false); onRefresh(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // "Customise from scratch" for a key that has no rows at all
  if (editing && !effective) {
    return (
      <BlockEditor
        initial={null}
        tenantId={tenantId}
        prefillKey={blockKey}
        onSave={() => { setEditing(false); onRefresh(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={[
      "rounded-xl border bg-white overflow-hidden transition-shadow",
      tenant ? "border-brand-200 shadow-sm" : "border-neutral-200",
    ].join(" ")}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2">
            <code className="text-xs font-mono font-semibold text-neutral-800">{blockKey}</code>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusCls}`}>
              {statusLabel}
            </span>
            {effective && (
              <span className="text-[10px] text-neutral-400">
                {effective.adaptiveVariants.length} adaptive variant{effective.adaptiveVariants.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Active toggle */}
          {effective && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleActive(!(tenant?.isActive ?? platform?.isActive))}
              className={[
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                (tenant?.isActive ?? platform?.isActive)
                  ? "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
              ].join(" ")}
            >
              {isPending ? "…" : (tenant?.isActive ?? platform?.isActive) ? "Deactivate" : "Activate"}
            </button>
          )}

          {/* Customise / Edit */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={btnSecondary}
          >
            {tenant ? "Edit" : "Customise"}
          </button>

          {/* Expand preview */}
          {effective && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={btnSecondary}
              aria-label={expanded ? "Collapse" : "Expand preview"}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}

          {/* Revert to platform */}
          {tenant && (
            confirming ? (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-neutral-500">Revert?</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRevert}
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
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={btnDanger}
                title="Delete tenant override and revert to platform default"
              >
                Revert
              </button>
            )
          )}
        </div>
      </div>

      {/* Content preview (collapsible) */}
      {expanded && effective && (
        <div className="px-4 py-3 space-y-3">
          {/* Default variant */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Default variant (SEO fallback)
            </p>
            <VariantPreviewCard content={effective.defaultVariant} />
          </div>

          {/* Adaptive variants */}
          {effective.adaptiveVariants.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Adaptive variants
              </p>
              <div className="space-y-1.5">
                {effective.adaptiveVariants.map((v, i) => (
                  <VariantPreviewCard
                    key={i}
                    content={v.content}
                    variantKey={v.variantKey}
                    label={v.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Platform vs tenant note */}
          {tenant && platform && (
            <p className="text-[10px] text-neutral-400 italic">
              Showing tenant override. Platform default has {platform.adaptiveVariants.length} variant{platform.adaptiveVariants.length !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Empty state — no rows at all */}
      {!effective && !editing && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-neutral-500">No block defined yet.</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-brand-600 hover:underline"
          >
            Create a tenant block for this key
          </button>
        </div>
      )}
    </div>
  );
}

// ── SlotSection ───────────────────────────────────────────────────────────────

interface SlotSectionProps {
  slotId:     string;
  keyPrefix:  string;
  blocks:     AdaptiveBlockData[];
  tenantId:   string;
  onRefresh:  () => void;
  onNewBlock: (prefixKey: string) => void;
}

function SlotSection({ slotId, keyPrefix, blocks, tenantId, onRefresh, onNewBlock }: SlotSectionProps) {
  const pairs = slotBlockPairs(keyPrefix, blocks, tenantId);

  const slotColors: Record<string, string> = {
    hero:         "bg-brand-50 text-brand-700 ring-brand-200",
    proof:        "bg-teal-50 text-teal-700 ring-teal-200",
    cta:          "bg-amber-50 text-amber-700 ring-amber-200",
    feature:      "bg-purple-50 text-purple-700 ring-purple-200",
    conversion:   "bg-green-50 text-green-700 ring-green-200",
    notification: "bg-red-50 text-red-700 ring-red-200",
  };

  const tenantCount  = pairs.filter((p) => p.tenant).length;
  const activeCount  = pairs.filter((p) => (p.tenant ?? p.platform)?.isActive).length;

  return (
    <div className="space-y-3">
      {/* Slot meta */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 pb-1 border-b border-neutral-100">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${slotColors[slotId] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}>
          {pairs.length} block{pairs.length !== 1 ? "s" : ""}
        </span>
        {tenantCount > 0 && (
          <span>{tenantCount} tenant override{tenantCount !== 1 ? "s" : ""}</span>
        )}
        <span>·</span>
        <span>{activeCount} active</span>
      </div>

      {pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 px-6 py-6 text-center">
          <p className="text-xs text-neutral-500">
            No platform blocks defined for this slot yet.
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            Go to the{" "}
            <Link href="/admin/platform/blocks" className="underline hover:text-neutral-600">
              platform blocks catalog
            </Link>{" "}
            to create them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => (
            <BlockStatusCard
              key={pair.key}
              blockKey={pair.key}
              platform={pair.platform}
              tenant={pair.tenant}
              tenantId={tenantId}
              slotPrefix={keyPrefix}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Add custom block for this slot */}
      <button
        type="button"
        onClick={() => onNewBlock(keyPrefix)}
        className="text-xs text-neutral-400 hover:text-brand-600 transition-colors mt-1"
      >
        + Add custom {slotId} block for this tenant
      </button>
    </div>
  );
}

// ── AdaptiveBlocksPanel ───────────────────────────────────────────────────────

interface AdaptiveBlocksPanelProps {
  tenantId:      string;
  initialBlocks: AdaptiveBlockData[];
}

export function AdaptiveBlocksPanel({ tenantId, initialBlocks }: AdaptiveBlocksPanelProps) {
  const [blocks,       setBlocks]       = useState<AdaptiveBlockData[]>(initialBlocks);
  const [activeSlot,   setActiveSlot]   = useState<string>(ADAPTIVE_SLOT_REGISTRY[0].id);
  const [creatingFor,  setCreatingFor]  = useState<string | null>(null); // key prefix for new block
  const [isPending,    startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listAdaptiveBlocksAction(tenantId, true);
      if (result.ok) setBlocks(result.blocks);
    });
  }, [tenantId]);

  // Per-slot counts for tab badges
  const slotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of ADAPTIVE_SLOT_REGISTRY) {
      const slotBlocks = blocks.filter((b) => b.key.startsWith(slot.keyPrefix));
      // Deduplicate by key
      const keys = new Set(slotBlocks.map((b) => b.key));
      counts[slot.id] = keys.size;
    }
    return counts;
  }, [blocks]);

  const currentSlot = ADAPTIVE_SLOT_REGISTRY.find((s) => s.id === activeSlot)!;

  return (
    <section className="space-y-5">

      {/* Panel header */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Adaptive blocks</h2>
        <p className="mt-0.5 text-xs text-neutral-500 max-w-2xl">
          Platform blocks personalise content for different visitor segments using tokens like{" "}
          <code className="font-mono text-[11px]">{"{{company_name}}"}</code> and{" "}
          <code className="font-mono text-[11px]">{"{{industry}}"}</code>.
          You can activate platform defaults as-is, or customise them with tenant-specific content and variants.
        </p>
      </div>

      {/* Slot tabs */}
      <div className="flex items-end gap-0 border-b border-neutral-200 overflow-x-auto">
        {ADAPTIVE_SLOT_REGISTRY.map((slot) => {
          const count   = slotCounts[slot.id] ?? 0;
          const isActive = slot.id === activeSlot;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setActiveSlot(slot.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300",
              ].join(" ")}
            >
              {slot.label}
              {count > 0 && (
                <span className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isActive
                    ? "bg-brand-100 text-brand-700"
                    : "bg-neutral-100 text-neutral-500",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Slot description */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
        <p className="text-xs text-neutral-600">{currentSlot.description}</p>
      </div>

      {/* New block inline editor (triggered by "Add custom" button) */}
      {creatingFor !== null && (
        <BlockEditor
          initial={null}
          tenantId={tenantId}
          prefillKey={creatingFor}
          onSave={() => { setCreatingFor(null); refresh(); }}
          onCancel={() => setCreatingFor(null)}
        />
      )}

      {/* Slot content */}
      <SlotSection
        slotId={currentSlot.id}
        keyPrefix={currentSlot.keyPrefix}
        blocks={blocks}
        tenantId={tenantId}
        onRefresh={refresh}
        onNewBlock={(prefix) => setCreatingFor(prefix)}
      />

      {isPending && (
        <p className="text-xs text-neutral-400 animate-pulse">Refreshing…</p>
      )}
    </section>
  );
}
