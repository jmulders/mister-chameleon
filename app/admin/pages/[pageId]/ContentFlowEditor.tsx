/**
 * ContentFlowEditor — interactive content block editor (PB4)
 *
 * Client component that manages the ordered ContentBlocks array of a page.
 *
 * ─── Capabilities ─────────────────────────────────────────────────────────────
 *
 *   Add block    — pick a type from the live registry, appended at bottom.
 *   Remove block — remove any block from the list.
 *   Move up/down — shift a block one position in render order.
 *   Edit block   — expand a block row to edit type, variant, and data (JSON).
 *   Save         — validates all block JSON, then calls saveContentBlocksAction.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Server (page.tsx)
 *     → serialised EditableContentBlock[] (initialBlocks)
 *     → serialised BlockDefInfo[] (blockDefs — live registry subset)
 *   Client (this component)
 *     → local BlockRow[] state (adds rawJson + jsonError per block)
 *     → on save: validates JSON, maps to EditableContentBlock[], calls server action
 *   Server action (actions.ts → pages/store.ts)
 *     → persists contentBlocks; revalidates /admin/pages and /admin/pages/[pageId]
 *
 * ─── Save alignment ───────────────────────────────────────────────────────────
 *
 *   Saved structure matches EditableContentBlock exactly:
 *     id        — stable (preserved from initial or crypto.randomUUID() for new)
 *     blockType — string key matching ContentBlockKey
 *     variant   — string | undefined  (empty string → undefined)
 *     data      — Record<string, unknown> from JSON.parse (renderer narrows via blockType)
 */

"use client";

import { useState, useTransition, useId } from "react";
import Image                                           from "next/image";
import { saveContentBlocksAction }                     from "./actions";
import type { ActionResult }                           from "./actions";
import type { EditableContentBlock }                   from "@/page-store";
import { AssetPickerModal }                            from "@/components/admin/AssetPickerModal";
import { loadAssetsForPickerAction }                   from "@/lib/assets/asset-picker-action";
import type { SelectedAsset }                          from "@/components/admin/AssetPickerModal";
import { BLOCK_TOKEN_GROUPS, VALID_SURFACE_ROLES }     from "@/design-system/theme/block-token-set";
import type { BlockTokenSet, CuratedBlockTokens }      from "@/design-system/theme/block-token-set";

const SURFACE_OPTIONS = ["", ...VALID_SURFACE_ROLES] as const;
function isColorish(v: string): boolean { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }

// ── Serialisable block-def shape (passed from server) ─────────────────────────

export interface BlockDefInfo {
  key:             string;
  displayName:     string;
  category:        string;
  allowedVariants: string[];
}

// ── Internal per-row state ────────────────────────────────────────────────────

interface BlockRow {
  id:        string;
  blockType: string;
  variant:   string;
  rawJson:   string;
  jsonError: string | null;
  tokenSet:  string;
  tokens:    Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRows(blocks: EditableContentBlock[]): BlockRow[] {
  return blocks.map((b) => ({
    id:        b.id,
    blockType: b.blockType,
    variant:   b.variant ?? "",
    rawJson:   JSON.stringify(b.data ?? {}, null, 2),
    jsonError: null,
    tokenSet:  b.tokenSet ?? "",
    tokens:    { ...((b.tokens as Record<string, string>) ?? {}) },
  }));
}

function parseRows(rows: BlockRow[]): { blocks: EditableContentBlock[]; errors: Record<string, string> } {
  const blocks:  EditableContentBlock[] = [];
  const errors:  Record<string, string> = {};

  for (const row of rows) {
    try {
      const data = JSON.parse(row.rawJson || "{}") as Record<string, unknown>;
      blocks.push({
        id:        row.id,
        blockType: row.blockType as EditableContentBlock["blockType"],
        variant:   row.variant || undefined,
        ...(row.tokenSet.trim() ? { tokenSet: row.tokenSet.trim() } : {}),
        ...(Object.keys(row.tokens).length > 0
          ? { tokens: row.tokens as unknown as CuratedBlockTokens }
          : {}),
        data,
      });
    } catch {
      errors[row.id] = "Invalid JSON: please fix before saving.";
    }
  }

  return { blocks, errors };
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Category grouping for the add-block picker ────────────────────────────────

const CATEGORY_ORDER = ["text", "media", "social-proof", "features", "content", "conversion"] as const;

const CATEGORY_LABEL: Record<string, string> = {
  "text":         "Text",
  "media":        "Media",
  "social-proof": "Social proof",
  "features":     "Features",
  "content":      "Content",
  "conversion":   "Conversion",
};

// ── Image field helpers ───────────────────────────────────────────────────────

/**
 * Field names that are treated as image URL inputs.
 * These will be surfaced as "Pick from library" helpers inside the block editor.
 */
const IMAGE_URL_FIELD_SET = new Set([
  "src",
  "imageUrl",
  "coverImageUrl",
  "backgroundImageUrl",
  "heroImageUrl",
  "posterUrl",
  "avatarUrl",
  "photoUrl",
  "logoUrl",
  "thumbnailUrl",
  "bannerUrl",
  "iconUrl",
  "pictureUrl",
  "mediaUrl",
  "heroImage",
  "cardImageUrl",
  "image",
]);

/**
 * For a given image field name, return the corresponding alt-text field name
 * (if any) so that selecting a library asset auto-fills the alt field too.
 */
const ALT_COMPANION: Record<string, string> = {
  src:                  "alt",
  imageUrl:             "imageAlt",
  coverImageUrl:        "coverImageAlt",
  backgroundImageUrl:   "backgroundImageAlt",
  heroImageUrl:         "heroImageAlt",
  avatarUrl:            "avatarAlt",
  posterUrl:            "posterAlt",
  photoUrl:             "photoAlt",
  logoUrl:              "logoAlt",
  thumbnailUrl:         "thumbnailAlt",
};

/** Detect top-level string fields in JSON that look like image URLs. */
function detectImageFields(rawJson: string): string[] {
  try {
    const obj = JSON.parse(rawJson || "{}") as Record<string, unknown>;
    return Object.keys(obj).filter((key) => {
      const val = obj[key];
      if (typeof val !== "string" && val !== null && val !== undefined) return false;
      if (IMAGE_URL_FIELD_SET.has(key)) return true;
      // Also catch any field ending with "Url" (e.g. customLogoUrl, teamPhotoUrl)
      if (key.endsWith("Url")) return true;
      return false;
    });
  } catch {
    return [];
  }
}

/** Return the value of a field from raw JSON (or "" on error / missing). */
function getJsonField(rawJson: string, field: string): string {
  try {
    const obj = JSON.parse(rawJson || "{}") as Record<string, unknown>;
    return typeof obj[field] === "string" ? (obj[field] as string) : "";
  } catch {
    return "";
  }
}

/**
 * Patch one (or two) top-level fields in a raw JSON string and re-serialise.
 * Returns the original string unchanged if the JSON is currently invalid.
 */
function patchJsonFields(
  rawJson: string,
  patches: Record<string, string>,
): string {
  try {
    const obj = JSON.parse(rawJson || "{}") as Record<string, unknown>;
    for (const [k, v] of Object.entries(patches)) {
      obj[k] = v;
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return rawJson;
  }
}

// ── ImageFieldRow — one image-field picker inside BlockEditorPanel ─────────────

function ImageFieldRow({
  fieldName,
  currentUrl,
  tenantId,
  onPick,
}: {
  fieldName:  string;
  currentUrl: string;
  tenantId:   string;
  onPick:     (fieldName: string, asset: SelectedAsset) => void;
}) {
  const hasImage = Boolean(currentUrl);

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
      {/* Thumbnail */}
      <div className="shrink-0 relative size-10 rounded bg-neutral-100 overflow-hidden border border-neutral-200 flex items-center justify-center">
        {hasImage ? (
          <Image
            src={currentUrl}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        ) : (
          <span className="text-neutral-300 text-base" aria-hidden="true">🖼</span>
        )}
      </div>

      {/* Field name + URL preview */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-neutral-700 font-mono">{fieldName}</p>
        {hasImage ? (
          <p className="text-[10px] text-neutral-400 truncate" title={currentUrl}>{currentUrl}</p>
        ) : (
          <p className="text-[10px] text-neutral-400 italic">No image set</p>
        )}
      </div>

      {/* Picker trigger */}
      <AssetPickerModal
        tenantId={tenantId}
        loadAssets={loadAssetsForPickerAction}
        currentUrl={currentUrl || undefined}
        onSelect={(asset) => onPick(fieldName, asset)}
        trigger={
          <button
            type="button"
            className="shrink-0 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-brand-400 hover:text-brand-700 transition-colors whitespace-nowrap"
          >
            {hasImage ? "Change" : "Pick image"}
          </button>
        }
      />

      {/* Clear button (only when set) */}
      {hasImage && (
        <button
          type="button"
          title="Clear image"
          onClick={() => onPick(fieldName, {
            publicUrl: "",
            altText:   "",
            title:     "",
            mimeType:  null,
            width:     null,
            height:    null,
            assetId:   "",
          })}
          className="shrink-0 text-neutral-300 hover:text-error-500 transition-colors text-sm"
          aria-label={`Clear ${fieldName}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Small primitives ──────────────────────────────────────────────────────────

function IconButton({
  onClick,
  disabled,
  title,
  children,
  variant = "ghost",
}: {
  onClick:   () => void;
  disabled?: boolean;
  title:     string;
  children:  React.ReactNode;
  variant?:  "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[
        "inline-flex size-7 items-center justify-center rounded text-xs font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "danger"
          ? "text-error-600 hover:bg-error-50"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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

function StatusBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        result.ok
          ? "rounded-md border border-success-200 bg-success-50 px-4 py-2.5 text-sm text-success-700"
          : "rounded-md border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700"
      }
    >
      {result.ok ? "Content flow saved." : (result.error ?? "Save failed: please try again.")}
    </div>
  );
}

// ── Expanded block editor panel ───────────────────────────────────────────────

function BlockEditorPanel({
  row,
  def,
  onTypeChange,
  onVariantChange,
  onJsonChange,
  onTokenSetChange,
  onTokenChange,
  uid,
  tenantId,
  blockTokenSets,
}: {
  row:            BlockRow;
  def:            BlockDefInfo | undefined;
  onTypeChange:   (type: string) => void;
  onVariantChange:(variant: string) => void;
  onJsonChange:   (raw: string) => void;
  onTokenSetChange:(v: string) => void;
  onTokenChange:  (field: string, value: string) => void;
  uid:            string;
  tenantId?:      string;
  blockTokenSets?: readonly BlockTokenSet[];
}) {
  const typeId    = `type-${uid}`;
  const variantId = `variant-${uid}`;
  const dataId    = `data-${uid}`;

  const variants = def?.allowedVariants ?? [];

  return (
    <div className="border-t border-neutral-100 bg-neutral-50 px-4 pb-4 pt-3">
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Block type */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={typeId}>Block type</FieldLabel>
          <select
            id={typeId}
            value={row.blockType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {/* current value always present even if not in the passed defs */}
            <option value={row.blockType}>{def?.displayName ?? row.blockType}</option>
          </select>
          <p className="text-xs text-neutral-400">
            To change type, remove this block and add a new one. Type changes clear the data field.
          </p>
        </div>

        {/* Variant */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={variantId}>Variant</FieldLabel>
          {variants.length > 0 ? (
            <select
              id={variantId}
              value={row.variant}
              onChange={(e) => onVariantChange(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="">: default: </option>
              {variants.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              id={variantId}
              type="text"
              value={row.variant}
              onChange={(e) => onVariantChange(e.target.value)}
              placeholder="e.g. compact"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          )}
        </div>
      </div>

      {/* ── Image field helpers (only when tenantId is available) ─────────── */}
      {tenantId && (() => {
        const imageFields = detectImageFields(row.rawJson);
        if (imageFields.length === 0) return null;

        function handleImagePick(fieldName: string, asset: SelectedAsset) {
          const patches: Record<string, string> = { [fieldName]: asset.publicUrl };

          // Auto-fill companion alt text field if it exists in the JSON
          const altField = ALT_COMPANION[fieldName];
          if (altField) {
            const currentAlt = getJsonField(row.rawJson, altField);
            // Only overwrite alt if it's blank or if asset has alt text
            if (!currentAlt || asset.altText) {
              patches[altField] = asset.altText;
            }
          }

          onJsonChange(patchJsonFields(row.rawJson, patches));
        }

        return (
          <div className="flex flex-col gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Image fields
            </p>
            {imageFields.map((fieldName) => (
              <ImageFieldRow
                key={fieldName}
                fieldName={fieldName}
                currentUrl={getJsonField(row.rawJson, fieldName)}
                tenantId={tenantId}
                onPick={handleImagePick}
              />
            ))}
          </div>
        );
      })()}

      {/* Data / props JSON editor */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={dataId}>Props (JSON)</FieldLabel>
        <textarea
          id={dataId}
          value={row.rawJson}
          onChange={(e) => onJsonChange(e.target.value)}
          rows={8}
          spellCheck={false}
          className={[
            "w-full resize-y rounded-md border bg-white px-3 py-2 font-mono text-xs text-neutral-800 outline-none",
            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500",
            row.jsonError ? "border-error-400" : "border-neutral-300",
          ].join(" ")}
        />
        {row.jsonError && (
          <p className="text-xs text-error-600">{row.jsonError}</p>
        )}
        <p className="text-xs text-neutral-400">
          Valid JSON object. Fields depend on the block type, check the block component for accepted props.
        </p>
      </div>

      {/* ── Design tokens (this block only) ──────────────────────────────── */}
      <BlockTokenControls
        row={row}
        blockTokenSets={blockTokenSets}
        onTokenSetChange={onTokenSetChange}
        onTokenChange={onTokenChange}
      />
    </div>
  );
}

// ── Per-block design-token controls ───────────────────────────────────────────

function BlockTokenControls({
  row,
  blockTokenSets,
  onTokenSetChange,
  onTokenChange,
}: {
  row:             BlockRow;
  blockTokenSets?: readonly BlockTokenSet[];
  onTokenSetChange:(v: string) => void;
  onTokenChange:   (field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = (row.tokenSet ? 1 : 0) + Object.keys(row.tokens).length;

  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Design tokens (this block only)
        </span>
        <span className="text-xs text-neutral-400">
          {count > 0 ? `${count} set` : "inherits site defaults"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-3 pb-3 pt-2">
          <p className="mb-2 text-[11px] text-neutral-400">
            Optional. Leave empty to inherit the site-wide design tokens. Set a named
            set and/or override individual values to restyle just this block.
          </p>

          {/* Named set selector */}
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500">Token set</span>
            <select
              value={row.tokenSet}
              onChange={(e) => onTokenSetChange(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">: none (inline / inherit), </option>
              {(blockTokenSets ?? []).map((s) => (
                <option key={s.key} value={s.key}>{s.name || s.key}</option>
              ))}
            </select>
          </label>

          {/* Grouped inline overrides */}
          {BLOCK_TOKEN_GROUPS.map((group) => (
            <div key={group.title} className="mt-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group.title}</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
                {group.fields.map((f) => {
                  const raw = row.tokens[f.key] ?? "";
                  return (
                    <label key={f.key} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-neutral-500">{f.label}</span>
                      {f.kind === "surface" ? (
                        <select
                          value={raw}
                          onChange={(e) => onTokenChange(f.key, e.target.value)}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          {SURFACE_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o === "" ? ": none: " : o}</option>
                          ))}
                        </select>
                      ) : f.kind === "color" ? (
                        <span className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={isColorish(raw) ? raw : "#ffffff"}
                            onChange={(e) => onTokenChange(f.key, e.target.value)}
                            className="h-7 w-8 shrink-0 cursor-pointer rounded border border-neutral-300 p-0"
                          />
                          <input
                            value={raw}
                            onChange={(e) => onTokenChange(f.key, e.target.value)}
                            placeholder="#111827 / rgba(…)"
                            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs"
                          />
                        </span>
                      ) : (
                        <input
                          value={raw}
                          onChange={(e) => onTokenChange(f.key, e.target.value)}
                          placeholder={f.placeholder ?? ""}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ContentFlowEditorProps {
  pageId:        string;
  initialBlocks: EditableContentBlock[];
  blockDefs:     BlockDefInfo[];
  /**
   * Optional override for the save action.  When provided this function is
   * called instead of the default `saveContentBlocksAction`.  Pass a bound
   * server action from a tenant-scoped parent route to keep saving within the
   * correct tenant context.
   *
   * Signature matches saveContentBlocksAction: (blocks) => Promise<ActionResult>
   */
  onSave?: (blocks: EditableContentBlock[]) => Promise<ActionResult>;
  /**
   * When provided, enables the asset-library image picker inside each block
   * editor panel.  Pass the active tenantId from the surrounding tenant-scoped
   * server component.
   */
  tenantId?: string;
  /**
   * The tenant's named block token sets (design.blockTokenSets). Enables the
   * per-block "Design tokens" controls so a content block can override the
   * site-wide defaults.
   */
  blockTokenSets?: readonly BlockTokenSet[];
}

export function ContentFlowEditor({ pageId, initialBlocks, blockDefs, onSave, tenantId, blockTokenSets }: ContentFlowEditorProps) {
  const [rows,        setRows]        = useState<BlockRow[]>(() => toRows(initialBlocks));
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [addType,     setAddType]     = useState<string>(blockDefs[0]?.key ?? "");
  const [status,      setStatus]      = useState<ActionResult | null>(null);
  const [jsonErrors,  setJsonErrors]  = useState<Record<string, string>>({});
  const [isPending,   startTransition] = useTransition();

  const defMap = Object.fromEntries(blockDefs.map((d) => [d.key, d]));
  const isDirty = true; // always allow save — user may have just reordered

  // uid for label/input association (stable across renders)
  const uid = useId();

  // ── Block-row mutations ───────────────────────────────────────────────────

  function updateRow(id: string, patch: Partial<BlockRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setStatus(null);
    if (patch.rawJson !== undefined) {
      // Clear per-block json error on edit
      setJsonErrors((prev) => ({ ...prev, [id]: "" }));
    }
  }

  function setBlockToken(id: string, field: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const tokens = { ...r.tokens };
        if (value.trim()) tokens[field] = value;
        else delete tokens[field];
        return { ...r, tokens };
      }),
    );
    setStatus(null);
  }

  function addBlock() {
    if (!addType) return;
    const def = defMap[addType];
    const id  = newId();
    const newRow: BlockRow = {
      id,
      blockType: addType,
      variant:   def?.allowedVariants[0] ?? "",
      rawJson:   "{}",
      jsonError: null,
      tokenSet:  "",
      tokens:    {},
    };
    setRows((prev) => [...prev, newRow]);
    setExpandedId(id);
    setStatus(null);
  }

  function removeBlock(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
    setStatus(null);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setRows((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setStatus(null);
  }

  function moveDown(idx: number) {
    setRows((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setStatus(null);
  }

  function handleTypeChange(id: string, type: string) {
    const def = defMap[type];
    updateRow(id, {
      blockType: type,
      variant:   def?.allowedVariants[0] ?? "",
      rawJson:   "{}",
      jsonError: null,
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    const { blocks, errors } = parseRows(rows);

    // Attach per-block json errors back into rows for display
    if (Object.keys(errors).length > 0) {
      setRows((prev) =>
        prev.map((r) => ({ ...r, jsonError: errors[r.id] ?? null })),
      );
      setJsonErrors(errors);
      return;
    }

    startTransition(async () => {
      // Use injected onSave if provided (tenant-scoped route); fall back to the
      // default global action for the legacy /admin/pages/[pageId] route.
      const res = onSave
        ? await onSave(blocks)
        : await saveContentBlocksAction(pageId, blocks);
      setStatus(res);
      if (res.ok) {
        // Normalise rows after successful save (pretty-print JSON)
        setRows(toRows(blocks));
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasJsonErrors = Object.values(jsonErrors).some(Boolean);

  // Group block defs by category for the add picker <optgroup>
  const groupedDefs = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      label:    CATEGORY_LABEL[cat] ?? cat,
      defs:     blockDefs.filter((d) => d.category === cat),
    }))
    .filter((g) => g.defs.length > 0);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Block list ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">

        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            No content blocks yet: add one below.
          </p>
        )}

        {rows.map((row, idx) => {
          const def        = defMap[row.blockType];
          const isExpanded = expandedId === row.id;
          const rowUid     = `${uid}-${row.id}`;

          return (
            <div
              key={row.id}
              className="border-b border-neutral-100 last:border-0"
            >
              {/* ── Row header ───────────────────────────────────────────────── */}
              <div
                className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer select-none"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : row.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                {/* Index badge */}
                <span className="shrink-0 inline-flex size-6 items-center justify-center rounded bg-neutral-100 text-xs font-semibold text-neutral-500 tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Expand chevron */}
                <span className="shrink-0 text-xs text-neutral-300 select-none">
                  {isExpanded ? "▼" : "▶"}
                </span>

                {/* Type label */}
                <span className="flex-1 text-sm font-medium text-neutral-800">
                  {def?.displayName ?? row.blockType}
                  <code className="ml-2 text-xs font-mono text-neutral-400">
                    {row.blockType}
                  </code>
                </span>

                {/* Variant chip */}
                {row.variant && (
                  <code className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 font-mono">
                    {row.variant}
                  </code>
                )}

                {/* JSON error indicator */}
                {(row.jsonError || jsonErrors[row.id]) && (
                  <span className="shrink-0 rounded bg-error-50 px-1.5 py-0.5 text-xs text-error-600">
                    JSON error
                  </span>
                )}

                {/* Order + remove controls */}
                <div
                  className="shrink-0 flex items-center gap-0.5 ml-2"
                  onClick={(e) => e.stopPropagation()} // don't toggle expand
                >
                  <IconButton
                    title="Move up"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    title="Move down"
                    onClick={() => moveDown(idx)}
                    disabled={idx === rows.length - 1}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    title="Remove block"
                    onClick={() => removeBlock(row.id)}
                    variant="danger"
                  >
                    ×
                  </IconButton>
                </div>
              </div>

              {/* ── Expanded editor ──────────────────────────────────────────── */}
              {isExpanded && (
                <BlockEditorPanel
                  row={row}
                  def={def}
                  uid={rowUid}
                  tenantId={tenantId}
                  blockTokenSets={blockTokenSets}
                  onTypeChange={(type) => handleTypeChange(row.id, type)}
                  onVariantChange={(variant) => updateRow(row.id, { variant, jsonError: null })}
                  onJsonChange={(raw) => updateRow(row.id, { rawJson: raw, jsonError: null })}
                  onTokenSetChange={(v) => updateRow(row.id, { tokenSet: v })}
                  onTokenChange={(field, value) => setBlockToken(row.id, field, value)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add block row ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
        <span className="shrink-0 text-sm text-neutral-500 font-medium">Add block</span>
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {groupedDefs.map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.defs.map((def) => (
                <option key={def.key} value={def.key}>
                  {def.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={addBlock}
          disabled={!addType}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      {/* ── Save row ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <StatusBanner result={status} />

        {hasJsonErrors && (
          <p className="text-xs text-error-600">
            Fix all JSON errors above before saving.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <span className="mr-2 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save content flow"
            )}
          </button>

          <span className="text-xs text-neutral-400">
            {rows.length} block{rows.length !== 1 ? "s" : ""} in render order
          </span>
        </div>
      </div>
    </div>
  );
}
