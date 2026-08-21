"use client";

/**
 * TenantBlocksClient
 *
 * Interactive block list for a specific tenant.
 *
 * Per block key shows:
 *   - "Customized"         — tenant has its own row (edit button)
 *   - "Platform default"   — using platform block (customize button)
 *   - "Not configured"     — no block exists at all (create button)
 *
 * Customize / Create open the edit drawer seeded with the platform-default
 * variant as an unsaved draft. NO tenant row is written on open: the drawer's
 * Save upserts on (key, tenant) and creates the tenant row only then. So a
 * Customize you cancel leaves the block on the platform default.
 */

import { useState, useCallback, useMemo, useTransition, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter }                             from "next/navigation";
import { EditBlockDrawer }                       from "@/components/admin/EditBlockDrawer";
import { BlockPreviewModal }                     from "@/components/admin/BlockPreviewModal";
import type { BlockTokenSet }                     from "@/design-system/theme/block-token-set";
import { deleteAdaptiveBlockAction } from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { saveSlotModesAction, type SaveSlotModesInput, type SlotModeFormValue } from "../slot-modes-actions";
import type { AdaptiveBlockData }                from "@/cms/types";
import type { TenantAdaptiveSlotSettings, TenantSlotMode, CustomAttributeDeclaration } from "@/tenant/types";

// ── Slot selection mode ─────────────────────────────────────────────────────────

/** The six slots that carry a selection mode (aligned with ADAPTIVE_SLOT_REGISTRY). */
type ModeSlotId = keyof SaveSlotModesInput;
const MODE_SLOT_IDS: readonly ModeSlotId[] = ["hero", "proof", "cta", "feature", "conversion", "notification"];

const MODE_OPTIONS: Array<{ value: TenantSlotMode; label: string; hint: string }> = [
  { value: "ai-assisted", label: "AI-assisted", hint: "AI may pick this slot when confidence gates pass, and falls back to rules." },
  { value: "rules-only",  label: "Rules only",  hint: "Always use the rules plan key. AI is never consulted for this slot." },
  { value: "static",      label: "Static",      hint: "Always serve the fixed key you choose, regardless of context." },
];

/** Build the editable slot-mode form from saved settings (defaults to ai-assisted). */
function buildSlotModes(saved: TenantAdaptiveSlotSettings | null): SaveSlotModesInput {
  const one = (id: ModeSlotId): SlotModeFormValue => ({
    mode:      saved?.[id]?.mode      ?? "ai-assisted",
    staticKey: saved?.[id]?.staticKey ?? "",
  });
  return {
    hero: one("hero"), proof: one("proof"), cta: one("cta"),
    feature: one("feature"), conversion: one("conversion"), notification: one("notification"),
  };
}

// ── SlotModeControl (inline, per slot section) ──────────────────────────────────

function SlotModeControl({
  value,
  knownKeys,
  onChange,
}: {
  value:     SlotModeFormValue;
  knownKeys: readonly string[];
  onChange:  (patch: Partial<SlotModeFormValue>) => void;
}) {
  const hint = MODE_OPTIONS.find((o) => o.value === value.mode)?.hint;
  return (
    <div className="flex flex-wrap items-center gap-2" title={hint}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Mode</span>
      <select
        value={value.mode}
        onChange={(e) => onChange({ mode: e.target.value as TenantSlotMode })}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value.mode === "static" && (
        <select
          value={value.staticKey ?? ""}
          onChange={(e) => onChange({ staticKey: e.target.value })}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>Choose a fixed key</option>
          {knownKeys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BlockStatus = "customized" | "platform" | "missing";

interface ResolvedBlock {
  blockKey:       string;
  status:         BlockStatus;
  tenantBlock?:   AdaptiveBlockData;
  platformBlock?: AdaptiveBlockData;
}

// The block a read-only preview should render.
interface PreviewTarget {
  blockKey:    string;
  variant:     AdaptiveBlockData["defaultVariant"];
  statusLabel: string;
}

// ── BlockRow ──────────────────────────────────────────────────────────────────

function BlockRow({
  resolved,
  tenantId,
  revalidatePath,
  onEdit,
  onCustomized,
  onPreview,
}: {
  resolved:       ResolvedBlock;
  tenantId:       string;
  revalidatePath: string;
  onEdit:         (block: AdaptiveBlockData) => void;
  onCustomized:   (block: AdaptiveBlockData) => void;
  onPreview:      (payload: PreviewTarget) => void;
}) {
  const router = useRouter();
  const [resetting, startReset] = useTransition();
  // The block a read-only preview would render: the tenant variant when
  // customized, else the platform-default variant. "missing" has no source.
  const block       = resolved.tenantBlock ?? resolved.platformBlock;
  const canPreview   = !!block;
  const statusLabel  = resolved.status === "customized" ? "tenant variant"
    : resolved.status === "platform" ? "platform default" : "not configured";

  function openPreview() {
    if (!block) return;
    onPreview({ blockKey: resolved.blockKey, variant: block.defaultVariant, statusLabel });
  }

  function handleReset() {
    const id = resolved.tenantBlock?.id;
    if (!id) return;
    if (!window.confirm(
      `Reset "${resolved.blockKey}" to the platform default? This tenant's customization for this block will be discarded.`,
    )) return;
    startReset(async () => {
      const res = await deleteAdaptiveBlockAction(id, revalidatePath);
      if (res.ok) router.refresh();
    });
  }

  function handleCustomize() {
    // Open the edit drawer seeded with the platform-default variant as an
    // UNSAVED draft. No tenant row is written here: the drawer's Save action
    // upserts on (key, tenant) and creates the tenant row only then, so a
    // Customize you cancel leaves the block on the platform default.
    if (resolved.platformBlock) {
      // Customize an inherited platform block: start from its content, but as a
      // new tenant row (id cleared so Save inserts instead of updating the
      // platform row).
      onCustomized({ ...resolved.platformBlock, id: "", tenantId });
    } else {
      // Create a not-configured block from scratch.
      onCustomized({
        id:               "",
        key:              resolved.blockKey,
        tenantId,
        isActive:         true,
        defaultVariant:   { title: "", subtitle: "" },
        adaptiveVariants: [],
      });
    }
  }

  const statusBadge = {
    customized: (
      <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-brand-200">
        Customized
      </span>
    ),
    platform: (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
        Platform default
      </span>
    ),
    missing: (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200">
        Not configured
      </span>
    ),
  }[resolved.status];

  return (
    <div
      className={[
        "group flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors",
        canPreview ? "cursor-pointer" : "",
        resolved.status === "customized"
          ? "border-brand-200 bg-brand-50/30 hover:border-brand-300"
          : resolved.status === "platform"
            ? "border-neutral-200 bg-white hover:border-neutral-300"
            : "border-dashed border-neutral-200 bg-neutral-50/50",
      ].join(" ")}
      // The whole row opens a read-only preview (keyboard-accessible). Action
      // buttons stopPropagation so they never trigger this.
      {...(canPreview ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `Preview ${resolved.blockKey}`,
        onClick: openPreview,
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(); }
        },
      } : {})}
    >

      <code className="min-w-0 flex-1 truncate text-xs font-mono font-semibold text-neutral-800">
        {resolved.blockKey}
      </code>

      {block?.defaultVariant.title && (
        <span className="hidden sm:block max-w-[200px] truncate text-[11px] text-neutral-400">
          {block.defaultVariant.title.length > 55
            ? `${block.defaultVariant.title.slice(0, 55)}…`
            : block.defaultVariant.title}
        </span>
      )}

      {statusBadge}

      {/* Preview (eye) — discoverable even without the row click. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openPreview(); }}
        disabled={!canPreview}
        title={canPreview ? "Preview this block" : "No preview — this block is not configured"}
        aria-label={`Preview ${resolved.blockKey}`}
        className="shrink-0 rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Actions */}
      {resolved.status === "customized" && resolved.tenantBlock && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(resolved.tenantBlock!); }}
            className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 opacity-0 transition-all hover:border-brand-300 hover:text-brand-600 group-hover:opacity-100"
          >
            Edit
          </button>
          {resolved.platformBlock && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              disabled={resetting}
              title="Discard this tenant's customization and fall back to the platform default"
              className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500 opacity-0 transition-all hover:border-red-300 hover:text-red-600 group-hover:opacity-100 disabled:opacity-40"
            >
              {resetting ? "…" : "Reset to default"}
            </button>
          )}
        </>
      )}

      {resolved.status === "platform" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleCustomize(); }}
          className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 opacity-0 transition-all hover:border-brand-300 hover:text-brand-700 group-hover:opacity-100"
        >
          Customize
        </button>
      )}

      {resolved.status === "missing" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleCustomize(); }}
          className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 opacity-0 transition-all hover:bg-amber-100 group-hover:opacity-100"
        >
          Create
        </button>
      )}

    </div>
  );
}

// ── SlotSection ───────────────────────────────────────────────────────────────

function SlotSection({
  id,
  label,
  description,
  keyPrefix,
  knownKeys,
  tenantId,
  revalidatePath,
  allBlocks,
  modeValue,
  onModeChange,
  onEdit,
  onCustomized,
  onPreview,
}: {
  id:             string;
  label:          string;
  description:    string;
  keyPrefix:      string;
  knownKeys:      readonly string[];
  tenantId:       string;
  revalidatePath: string;
  allBlocks:      AdaptiveBlockData[];
  modeValue?:     SlotModeFormValue;
  onModeChange?:  (patch: Partial<SlotModeFormValue>) => void;
  onEdit:         (block: AdaptiveBlockData) => void;
  onCustomized:   (block: AdaptiveBlockData) => void;
  onPreview:      (payload: PreviewTarget) => void;
}) {
  const tenantMap   = new Map(
    allBlocks.filter((b) => b.tenantId === tenantId && b.key.startsWith(keyPrefix)).map((b) => [b.key, b]),
  );
  const platformMap = new Map(
    allBlocks.filter((b) => !b.tenantId && b.key.startsWith(keyPrefix)).map((b) => [b.key, b]),
  );

  const resolved: ResolvedBlock[] = knownKeys.map((key) => {
    const tenantBlock   = tenantMap.get(key);
    const platformBlock = platformMap.get(key);
    const status: BlockStatus = tenantBlock ? "customized" : platformBlock ? "platform" : "missing";
    return { blockKey: key, status, tenantBlock, platformBlock };
  });

  const customizedCount = resolved.filter((r) => r.status === "customized").length;

  // ── Within-tab search + status filter (no pagination) ───────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BlockStatus>("all");
  const query = search.trim().toLowerCase();
  const filtered = resolved.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (query && !r.blockKey.toLowerCase().includes(query)) return false;
    return true;
  });

  const slotColors: Record<string, string> = {
    hero:         "bg-brand-50 text-brand-700 ring-brand-200",
    proof:        "bg-teal-50 text-teal-700 ring-teal-200",
    cta:          "bg-amber-50 text-amber-700 ring-amber-200",
    feature:      "bg-purple-50 text-purple-700 ring-purple-200",
    conversion:   "bg-green-50 text-green-700 ring-green-200",
    notification: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-neutral-900">{label}</h2>
            {customizedCount > 0 && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${slotColors[id] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}>
                {customizedCount} customized
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-400 max-w-2xl">{description}</p>
        </div>
        {modeValue && onModeChange && (
          <SlotModeControl value={modeValue} knownKeys={knownKeys} onChange={onModeChange} />
        )}
      </div>

      {/* Search + status filter (scoped to this slot). */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search block key…"
          aria-label={`Search ${label} block keys`}
          className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | BlockStatus)}
          aria-label={`Filter ${label} by status`}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">All</option>
          <option value="customized">Customized</option>
          <option value="platform">Platform default</option>
          <option value="missing">Not configured</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((r) => (
          <BlockRow
            key={r.blockKey}
            resolved={r}
            tenantId={tenantId}
            revalidatePath={revalidatePath}
            onEdit={onEdit}
            onCustomized={onCustomized}
            onPreview={onPreview}
          />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">
            No blocks match the current search or filter.
          </p>
        )}
      </div>
    </section>
  );
}

// ── TenantBlocksClient ────────────────────────────────────────────────────────

interface SlotSpec {
  id:          string;
  label:       string;
  description: string;
  keyPrefix:   string;
  knownKeys:   readonly string[];
}

interface TenantBlocksClientProps {
  tenantId:   string;
  slots:      readonly SlotSpec[];
  allBlocks:  AdaptiveBlockData[];
  initialSlotModes: TenantAdaptiveSlotSettings | null;
  blockTokenSets?: readonly BlockTokenSet[];
  customAttributes?: readonly CustomAttributeDeclaration[];
}

export function TenantBlocksClient({ tenantId, slots, allBlocks, initialSlotModes, blockTokenSets = [], customAttributes = [] }: TenantBlocksClientProps) {
  const router          = useRouter();
  const revalidatePath  = `/admin/tenants/${tenantId}/personalization/blocks`;
  const [editing, setEditing] = useState<AdaptiveBlockData | null>(null);
  const [previewing, setPreviewing] = useState<PreviewTarget | null>(null);

  // Per-slot selection mode (AI-assisted / rules-only / static), edited inline
  // in each slot section and saved together via the bar below.
  const savedModes = useMemo(() => buildSlotModes(initialSlotModes), [initialSlotModes]);
  const [slotModes, setSlotModes] = useState<SaveSlotModesInput>(savedModes);
  const [modeStatus, setModeStatus] = useState<"idle" | "success" | "error">("idle");
  const [modeError,  setModeError]  = useState("");
  const [savingModes, startSaveModes] = useTransition();
  const modesDirty = useMemo(
    () => JSON.stringify(slotModes) !== JSON.stringify(savedModes),
    [slotModes, savedModes],
  );

  const patchMode = useCallback((slotId: ModeSlotId, patch: Partial<SlotModeFormValue>) => {
    setModeStatus("idle");
    setSlotModes((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));
  }, []);

  const saveModes = useCallback(() => {
    setModeStatus("idle");
    startSaveModes(async () => {
      const res = await saveSlotModesAction(tenantId, slotModes);
      if (res.ok) { setModeStatus("success"); router.refresh(); }
      else { setModeStatus("error"); setModeError(res.error ?? "Unknown error"); }
    });
  }, [tenantId, slotModes, router]);

  const handleSaved = useCallback(() => {
    setEditing(null);
    router.refresh();
  }, [router]);

  // ── Tabs: one per slot, only the active slot's blocks render ────────────────
  const STORAGE_KEY = `mc-blocks-tab-${tenantId}`;
  const [activeSlot, setActiveSlot] = useState<string>(slots[0]?.id ?? "");
  // Restore the last-viewed tab on mount (kept out of the initial render to avoid
  // a hydration mismatch), so an edit + refresh does not jump back to the first tab.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && slots.some((s) => s.id === saved)) setActiveSlot(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectSlot = useCallback((id: string) => {
    setActiveSlot(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, [STORAGE_KEY]);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  function onTabKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % slots.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + slots.length) % slots.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = slots.length - 1;
    else return;
    e.preventDefault();
    selectSlot(slots[next].id);
    tabRefs.current[next]?.focus();
  }

  // Per-slot totals + customized count for the tab badges.
  const slotCounts = useMemo(() => {
    const map: Record<string, { total: number; customized: number }> = {};
    for (const slot of slots) {
      const tenantKeys = new Set(
        allBlocks.filter((b) => b.tenantId === tenantId && b.key.startsWith(slot.keyPrefix)).map((b) => b.key),
      );
      map[slot.id] = {
        total:      slot.knownKeys.length,
        customized: slot.knownKeys.filter((k) => tenantKeys.has(k)).length,
      };
    }
    return map;
  }, [slots, allBlocks, tenantId]);

  const activeSpec = slots.find((s) => s.id === activeSlot) ?? slots[0];

  return (
    <>
      {/* ── Slot tabs ─────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Block slots" className="flex flex-wrap gap-1 border-b border-neutral-200">
        {slots.map((slot, idx) => {
          const selected = slot.id === activeSpec?.id;
          const c = slotCounts[slot.id] ?? { total: 0, customized: 0 };
          return (
            <button
              key={slot.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              type="button"
              role="tab"
              id={`blocks-tab-${slot.id}`}
              aria-selected={selected}
              aria-controls={`blocks-panel-${slot.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectSlot(slot.id)}
              onKeyDown={(e) => onTabKeyDown(e, idx)}
              className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                selected
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {slot.label} <span className="text-neutral-400">· {c.total}</span>
              {c.customized > 0 && (
                <span className="ml-1 text-[11px] font-normal text-neutral-400">({c.customized} customized)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active slot panel ─────────────────────────────────────────────── */}
      {activeSpec && (
        <div
          role="tabpanel"
          id={`blocks-panel-${activeSpec.id}`}
          aria-labelledby={`blocks-tab-${activeSpec.id}`}
          className="mt-5"
        >
          <SlotSection
            key={activeSpec.id}
            id={activeSpec.id}
            label={activeSpec.label}
            description={activeSpec.description}
            keyPrefix={activeSpec.keyPrefix}
            knownKeys={activeSpec.knownKeys}
            tenantId={tenantId}
            revalidatePath={revalidatePath}
            allBlocks={allBlocks}
            modeValue={(MODE_SLOT_IDS as readonly string[]).includes(activeSpec.id) ? slotModes[activeSpec.id as ModeSlotId] : undefined}
            onModeChange={(MODE_SLOT_IDS as readonly string[]).includes(activeSpec.id) ? (patch) => patchMode(activeSpec.id as ModeSlotId, patch) : undefined}
            onEdit={setEditing}
            onCustomized={(block) => setEditing(block)}
            onPreview={setPreviewing}
          />
        </div>
      )}

      {/* Slot-mode save bar — appears once a mode changes */}
      {(modesDirty || modeStatus !== "idle") && (
        <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="text-xs text-neutral-500">
            {modeStatus === "success" && !modesDirty
              ? <span className="font-medium text-green-600">Slot modes saved.</span>
              : modeStatus === "error"
                ? <span className="text-red-600">{modeError}</span>
                : "You changed how one or more slots select their variant."}
          </div>
          <button
            type="button"
            onClick={saveModes}
            disabled={savingModes || !modesDirty}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingModes ? "Saving…" : "Save slot modes"}
          </button>
        </div>
      )}

      {editing && (
        <EditBlockDrawer
          block={{ ...editing, tenantId }}
          tenantId={tenantId}
          revalidatePath={revalidatePath}
          blockTokenSets={blockTokenSets}
          customAttributes={customAttributes}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {previewing && (
        <BlockPreviewModal
          tenantId={tenantId}
          blockKey={previewing.blockKey}
          variant={previewing.variant}
          statusLabel={previewing.statusLabel}
          onClose={() => setPreviewing(null)}
        />
      )}
    </>
  );
}
