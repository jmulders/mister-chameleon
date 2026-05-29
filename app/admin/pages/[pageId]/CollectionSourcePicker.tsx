/**
 * CollectionSourcePicker — admin UI for configuring a block's content source
 *
 * Allows editors to switch a list-like block (newsList, listing, relatedContent)
 * between:
 *   - Manual items  — the block's inline items array is rendered as-authored
 *   - Collection → Recent   — N most recent items from a collection
 *   - Collection → Specific — hand-picked items in explicit order
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Place this component in the block editor panel for any block that supports
 *   a `contentSource` field.  It is a controlled component: the parent owns the
 *   ContentSource value and passes it in via `value`.
 *
 * @example
 * <CollectionSourcePicker
 *   value={blockData.contentSource}
 *   onChange={(src) => updateBlockData({ ...blockData, contentSource: src })}
 * />
 *
 * ─── Ordering ─────────────────────────────────────────────────────────────────
 *
 *   In "specific" mode, selected IDs are shown as a reorderable list.
 *   Editors use the ↑/↓ arrow buttons to change the item order.  The saved
 *   selectedIds array IS the render order — it is never re-sorted by the
 *   platform at display time.
 *
 * ─── CMS IDs ──────────────────────────────────────────────────────────────────
 *
 *   The component accepts a free-text ID input.  In a full CMS-integrated
 *   implementation, this would be replaced by a reference picker that queries
 *   the CMS (e.g. /api/cms/collection?key=articles) for item suggestions.
 *   The free-text fallback preserves editorial functionality without requiring
 *   a live CMS connection.
 */

"use client";

import { useState, useId } from "react";
import type {
  ContentSource,
  CollectionKey,
  CollectionSourceMode,
  CollectionSortDir,
  CollectionContentSource,
} from "@/page-config/collection-source";
import { COLLECTION_KEY_LABELS } from "@/page-config/collection-source";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface CollectionSourcePickerProps {
  /**
   * Current ContentSource value.  Pass `undefined` to represent the implicit
   * manual default (no contentSource authored in the block data).
   */
  value?:    ContentSource;
  /** Called on every change; parent is responsible for persisting the value. */
  onChange:  (src: ContentSource | undefined) => void;
  /**
   * Which collections should be offered to the editor.
   * Defaults to all five CollectionKeys when omitted.
   */
  availableCollections?: readonly CollectionKey[];
  /** Optional CSS class name applied to the outermost wrapper. */
  className?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_COLLECTIONS: readonly CollectionKey[] = [
  "articles", "vacancies", "cases", "news", "companies",
];

const MODE_LABELS: Record<CollectionSourceMode, string> = {
  recent:   "Most recent",
  specific: "Specific items",
};

const SORT_LABELS: Record<CollectionSortDir, string> = {
  desc: "Newest first",
  asc:  "Oldest first",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CollectionSourcePicker({
  value,
  onChange,
  availableCollections = DEFAULT_COLLECTIONS,
  className,
}: CollectionSourcePickerProps) {
  const uid         = useId();
  const [newId, setNewId] = useState("");

  // ── Derive local state from value ─────────────────────────────────────────

  const activeSource = value?.source ?? "manual";

  const collectionSrc: CollectionContentSource | null =
    value?.source === "collection" ? value : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSourceToggle(source: "manual" | "collection") {
    if (source === "manual") {
      onChange(undefined);
      return;
    }
    // Switch to collection — use previous settings or sensible defaults
    onChange({
      source:     "collection",
      collection: collectionSrc?.collection ?? availableCollections[0],
      mode:       collectionSrc?.mode       ?? "recent",
      limit:      collectionSrc?.limit      ?? 6,
      sortDir:    collectionSrc?.sortDir    ?? "desc",
      selectedIds: collectionSrc?.selectedIds ?? [],
    });
  }

  function handleCollectionChange(col: CollectionKey) {
    if (!collectionSrc) return;
    onChange({ ...collectionSrc, collection: col });
  }

  function handleModeChange(mode: CollectionSourceMode) {
    if (!collectionSrc) return;
    onChange({ ...collectionSrc, mode });
  }

  function handleLimitChange(raw: string) {
    if (!collectionSrc) return;
    const n = parseInt(raw, 10);
    onChange({ ...collectionSrc, limit: isNaN(n) || n < 1 ? undefined : n });
  }

  function handleSortDirChange(dir: CollectionSortDir) {
    if (!collectionSrc) return;
    onChange({ ...collectionSrc, sortDir: dir });
  }

  // Specific mode — add an ID to selectedIds
  function handleAddId() {
    const trimmed = newId.trim();
    if (!collectionSrc || !trimmed) return;
    const existing = collectionSrc.selectedIds ?? [];
    if (existing.includes(trimmed)) { setNewId(""); return; }
    onChange({ ...collectionSrc, selectedIds: [...existing, trimmed] });
    setNewId("");
  }

  // Specific mode — remove an ID from selectedIds
  function handleRemoveId(id: string) {
    if (!collectionSrc) return;
    onChange({
      ...collectionSrc,
      selectedIds: (collectionSrc.selectedIds ?? []).filter((x) => x !== id),
    });
  }

  // Specific mode — move an ID up by one position
  function handleMoveUp(index: number) {
    if (!collectionSrc || index === 0) return;
    const ids = [...(collectionSrc.selectedIds ?? [])];
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    onChange({ ...collectionSrc, selectedIds: ids });
  }

  // Specific mode — move an ID down by one position
  function handleMoveDown(index: number) {
    if (!collectionSrc) return;
    const ids = [...(collectionSrc.selectedIds ?? [])];
    if (index >= ids.length - 1) return;
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    onChange({ ...collectionSrc, selectedIds: ids });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm ${className ?? ""}`}>

      {/* ── Source mode toggle ────────────────────────────────────────── */}
      <fieldset>
        <legend className="mb-2 block font-medium text-gray-700">Content source</legend>
        <div className="flex gap-3">
          {(["manual", "collection"] as const).map((src) => (
            <label
              key={src}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                activeSource === src
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name={`${uid}-source`}
                value={src}
                checked={activeSource === src}
                onChange={() => handleSourceToggle(src)}
                className="sr-only"
              />
              {src === "manual" ? "Manual items" : "From collection"}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {activeSource === "manual"
            ? "Items are authored directly in this block."
            : "Items are fetched from a content collection at render time."}
        </p>
      </fieldset>

      {/* ── Collection config — only when source = collection ─────────── */}
      {activeSource === "collection" && collectionSrc && (
        <>
          {/* Collection picker */}
          <div>
            <label htmlFor={`${uid}-collection`} className="mb-1 block font-medium text-gray-700">
              Collection
            </label>
            <select
              id={`${uid}-collection`}
              value={collectionSrc.collection}
              onChange={(e) => handleCollectionChange(e.target.value as CollectionKey)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {availableCollections.map((key) => (
                <option key={key} value={key}>
                  {COLLECTION_KEY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Selection mode */}
          <div>
            <span className="mb-1 block font-medium text-gray-700">Selection mode</span>
            <div className="flex gap-3">
              {(["recent", "specific"] as const).map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                    collectionSrc.mode === mode
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${uid}-mode`}
                    value={mode}
                    checked={collectionSrc.mode === mode}
                    onChange={() => handleModeChange(mode)}
                    className="sr-only"
                  />
                  {MODE_LABELS[mode]}
                </label>
              ))}
            </div>
          </div>

          {/* Recent mode controls */}
          {collectionSrc.mode === "recent" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${uid}-limit`} className="mb-1 block font-medium text-gray-700">
                  Max items
                </label>
                <input
                  id={`${uid}-limit`}
                  type="number"
                  min={1}
                  max={50}
                  value={collectionSrc.limit ?? ""}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  placeholder="e.g. 6"
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-sortdir`} className="mb-1 block font-medium text-gray-700">
                  Order
                </label>
                <select
                  id={`${uid}-sortdir`}
                  value={collectionSrc.sortDir ?? "desc"}
                  onChange={(e) => handleSortDirChange(e.target.value as CollectionSortDir)}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {(["desc", "asc"] as const).map((dir) => (
                    <option key={dir} value={dir}>{SORT_LABELS[dir]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Specific mode controls */}
          {collectionSrc.mode === "specific" && (
            <div>
              <p className="mb-2 font-medium text-gray-700">
                Selected items
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (order determines render order — use ↑/↓ to reorder)
                </span>
              </p>

              {/* Reorderable ID list */}
              <ol className="mb-3 space-y-1.5">
                {(collectionSrc.selectedIds ?? []).map((id, i) => {
                  const ids   = collectionSrc.selectedIds ?? [];
                  const isFirst = i === 0;
                  const isLast  = i === ids.length - 1;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-mono text-gray-400">{i + 1}</span>
                      <span className="flex-1 truncate font-mono text-xs text-gray-800">{id}</span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveUp(i)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                          title="Move up"
                          aria-label={`Move item ${id} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveDown(i)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                          title="Move down"
                          aria-label={`Move item ${id} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveId(id)}
                          className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove"
                          aria-label={`Remove item ${id}`}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
                {(collectionSrc.selectedIds ?? []).length === 0 && (
                  <li className="rounded-md border border-dashed border-gray-200 px-3 py-2 text-center text-xs text-gray-400">
                    No items selected — add CMS document IDs below
                  </li>
                )}
              </ol>

              {/* Add ID input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddId(); } }}
                  placeholder="CMS document ID"
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddId}
                  disabled={!newId.trim()}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Enter the stable CMS document ID for each item you want to include.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
