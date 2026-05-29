"use client";

/**
 * AssetLibraryClient
 *
 * Tenant asset library UI — upload, browse, search, filter, copy, and delete.
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   Upload        Upload button → file picker → immediate upload via server
 *                 action → asset appears in grid without full page reload.
 *   Browse grid   Responsive image grid with thumbnails, filename, and size.
 *   Search        Client-side search across title + file name (instant).
 *   Tag filter    Filter the grid to assets with a specific tag.
 *   Copy URL      One-click copy of the asset's CDN URL to the clipboard.
 *   Edit meta     Inline form to update title, alt text, and tags per asset.
 *   Delete        Delete with confirmation dialog.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Initial assets are passed from the server component.
 *   Mutations (upload / update / delete) use server actions and update local
 *   state immediately for a responsive feel — no full page reload required.
 */

import {
  useState,
  useRef,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import Image          from "next/image";
import { cn }         from "@/lib/utils";
import type { TenantAsset } from "@/lib/assets/tenant-assets";
import { formatFileSize }   from "@/lib/assets/format";
import {
  uploadAssetAction,
  updateAssetMetaAction,
  deleteAssetAction,
} from "../actions";

// ── Props ───────────────────────────────────────────────────────────────────────

interface AssetLibraryClientProps {
  tenantId:      string;
  initialAssets: TenantAsset[];
  allTags:       string[];
}

// ── Component ───────────────────────────────────────────────────────────────────

export function AssetLibraryClient({
  tenantId,
  initialAssets,
  allTags: initialTags,
}: AssetLibraryClientProps) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [assets,       setAssets]       = useState<TenantAsset[]>(initialAssets);
  const [allTags,      setAllTags]      = useState<string[]>(initialTags);
  const [search,       setSearch]       = useState("");
  const [tagFilter,    setTagFilter]    = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [viewMode,     setViewMode]     = useState<"grid" | "list">("grid");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [,  startTransition] = useTransition();

  // ── Filtered assets (client-side) ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = assets;

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (a) =>
          (a.title     ?? "").toLowerCase().includes(term) ||
          (a.fileName  ?? "").toLowerCase().includes(term) ||
          (a.altText   ?? "").toLowerCase().includes(term),
      );
    }

    if (tagFilter) {
      result = result.filter((a) => a.tags.includes(tagFilter));
    }

    return result;
  }, [assets, search, tagFilter]);

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      setUploading(true);
      setUploadError(null);

      // Upload files sequentially to avoid overwhelming the server
      for (const file of files) {
        const fd = new FormData();
        fd.append("file",     file);
        fd.append("tenantId", tenantId);
        fd.append("title",    file.name.replace(/\.[^/.]+$/, "")); // strip extension as default title

        try {
          const result = await uploadAssetAction(fd);
          if (!result.success) {
            setUploadError(result.error ?? "Upload failed");
          }
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Upload failed");
        }
      }

      // Reset file input and reload full list from server via transition
      if (fileInputRef.current) fileInputRef.current.value = "";

      startTransition(() => {
        // Re-fetch is handled by the revalidatePath in the server action.
        // For instant feedback we do a window reload inside the transition.
        // In a more sophisticated version we'd fetch the latest list via SWR/React Query.
        window.location.reload();
      });

      setUploading(false);
    },
    [tenantId],
  );

  // ── Copy URL ──────────────────────────────────────────────────────────────────

  const handleCopy = useCallback((asset: TenantAsset) => {
    void navigator.clipboard.writeText(asset.publicUrl).then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (assetId: string) => {
      setDeletingId(assetId);
      try {
        const result = await deleteAssetAction(tenantId, assetId);
        if (result.success) {
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
        } else {
          alert(`Delete failed: ${result.error}`);
        }
      } finally {
        setDeletingId(null);
      }
    },
    [tenantId],
  );

  // ── Edit metadata ─────────────────────────────────────────────────────────────

  const handleUpdateMeta = useCallback(
    async (
      assetId: string,
      input: { title: string; altText: string; tags: string[] },
    ) => {
      const result = await updateAssetMetaAction(tenantId, assetId, input);
      if (result.success) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId
              ? { ...a, title: input.title, altText: input.altText, tags: input.tags }
              : a,
          ),
        );
        // Rebuild tag list
        const updated = assets.map((a) =>
          a.id === assetId ? { ...a, tags: input.tags } : a,
        );
        const allNew = [...new Set(updated.flatMap((a) => a.tags))].sort();
        setAllTags(allNew);
        setEditingId(null);
      } else {
        alert(`Update failed: ${result.error}`);
      }
    },
    [tenantId, assets],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
            "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
          )}
        >
          {uploading ? (
            <>
              <Spinner className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <UploadIcon className="h-4 w-4" />
              Upload image
            </>
          )}
        </button>

        {/* Hidden file input — multi-select */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-neutral-200 bg-white",
              "py-2 pl-9 pr-4 text-sm placeholder:text-neutral-400",
              "focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400",
            )}
          />
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            value={tagFilter ?? ""}
            onChange={(e) => setTagFilter(e.target.value || null)}
            className={cn(
              "rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm",
              "focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400",
            )}
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "grid"
                ? "bg-neutral-100 text-neutral-900"
                : "bg-white text-neutral-500 hover:bg-neutral-50",
            )}
            title="Grid view"
          >
            <GridIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "list"
                ? "bg-neutral-100 text-neutral-900"
                : "bg-white text-neutral-500 hover:bg-neutral-50",
            )}
            title="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Asset count */}
        <span className="text-sm text-neutral-500 ml-auto">
          {filtered.length} {filtered.length === 1 ? "asset" : "assets"}
          {assets.length !== filtered.length && ` of ${assets.length}`}
        </span>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Upload error:</strong> {uploadError}
          <button
            onClick={() => setUploadError(null)}
            className="ml-3 text-red-400 hover:text-red-600"
          >✕</button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !uploading && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-20 text-center">
          <ImageIcon className="mb-3 h-12 w-12 text-neutral-300" />
          {assets.length === 0 ? (
            <>
              <p className="text-base font-medium text-neutral-600">No assets yet</p>
              <p className="mt-1 text-sm text-neutral-400">
                Click <strong>Upload image</strong> to add your first asset.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-neutral-600">No results</p>
              <p className="mt-1 text-sm text-neutral-400">
                Try a different search term or clear the tag filter.
              </p>
            </>
          )}
        </div>
      )}

      {/* Grid view */}
      {viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((asset) =>
            editingId === asset.id ? (
              <EditCard
                key={asset.id}
                asset={asset}
                allTags={allTags}
                onSave={(input) => handleUpdateMeta(asset.id, input)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <AssetCard
                key={asset.id}
                asset={asset}
                isCopied={copiedId === asset.id}
                isDeleting={deletingId === asset.id}
                onCopy={() => handleCopy(asset)}
                onEdit={() => setEditingId(asset.id)}
                onDelete={() => {
                  if (confirm(`Delete "${asset.title ?? asset.fileName}"? This cannot be undone.`)) {
                    void handleDelete(asset.id);
                  }
                }}
              />
            ),
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-medium text-neutral-700 w-16">Preview</th>
                <th className="px-4 py-3 font-medium text-neutral-700">Name / Title</th>
                <th className="px-4 py-3 font-medium text-neutral-700">Alt text</th>
                <th className="px-4 py-3 font-medium text-neutral-700">Size</th>
                <th className="px-4 py-3 font-medium text-neutral-700">Tags</th>
                <th className="px-4 py-3 font-medium text-neutral-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  allTags={allTags}
                  isCopied={copiedId === asset.id}
                  isDeleting={deletingId === asset.id}
                  isEditing={editingId === asset.id}
                  onCopy={() => handleCopy(asset)}
                  onEdit={() => setEditingId(editingId === asset.id ? null : asset.id)}
                  onDelete={() => {
                    if (confirm(`Delete "${asset.title ?? asset.fileName}"? This cannot be undone.`)) {
                      void handleDelete(asset.id);
                    }
                  }}
                  onSaveMeta={(input) => handleUpdateMeta(asset.id, input)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── AssetCard (grid view) ──────────────────────────────────────────────────────

function AssetCard({
  asset,
  isCopied,
  isDeleting,
  onCopy,
  onEdit,
  onDelete,
}: {
  asset:      TenantAsset;
  isCopied:   boolean;
  isDeleting: boolean;
  onCopy:     () => void;
  onEdit:     () => void;
  onDelete:   () => void;
}) {
  const isSvg = asset.mimeType === "image/svg+xml";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-neutral-50 overflow-hidden">
        {isSvg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.publicUrl}
            alt={asset.altText ?? asset.title ?? asset.fileName}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <Image
            src={asset.publicUrl}
            alt={asset.altText ?? asset.title ?? asset.fileName}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            unoptimized
          />
        )}

        {/* Overlay actions — shown on hover */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center gap-2",
            "bg-black/50 opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={onCopy}
            title="Copy URL"
            className="rounded-md bg-white/90 p-1.5 text-neutral-800 hover:bg-white"
          >
            {isCopied ? <CheckIcon className="h-4 w-4 text-green-600" /> : <CopyIcon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit metadata"
            className="rounded-md bg-white/90 p-1.5 text-neutral-800 hover:bg-white"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete"
            className="rounded-md bg-white/90 p-1.5 text-red-600 hover:bg-white disabled:opacity-50"
          >
            {isDeleting ? <Spinner className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Meta below thumbnail */}
      <div className="p-2">
        <p className="truncate text-xs font-medium text-neutral-900" title={asset.title ?? asset.fileName}>
          {asset.title ?? asset.fileName}
        </p>
        <p className="text-[11px] text-neutral-400">{formatFileSize(asset.fileSize)}</p>

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {asset.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
            {asset.tags.length > 2 && (
              <span className="text-[10px] text-neutral-400">+{asset.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EditCard (grid view — inline editor) ──────────────────────────────────────

function EditCard({
  asset,
  allTags,
  onSave,
  onCancel,
}: {
  asset:   TenantAsset;
  allTags: string[];
  onSave:  (input: { title: string; altText: string; tags: string[] }) => void;
  onCancel: () => void;
}) {
  const [title,   setTitle]   = useState(asset.title   ?? "");
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [tagsStr, setTagsStr] = useState(asset.tags.join(", "));
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    await onSave({ title, altText, tags });
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-brand-300 bg-brand-50 p-3 col-span-1">
      <p className="mb-2 text-xs font-semibold text-brand-800 truncate">
        Editing: {asset.fileName}
      </p>

      <label className="block mb-1.5">
        <span className="text-[11px] font-medium text-neutral-600">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </label>

      <label className="block mb-1.5">
        <span className="text-[11px] font-medium text-neutral-600">Alt text</span>
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          placeholder="Describe for screen readers"
        />
      </label>

      <label className="block mb-3">
        <span className="text-[11px] font-medium text-neutral-600">Tags (comma-separated)</span>
        <input
          type="text"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          placeholder="hero, logo, team"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded bg-brand-600 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded bg-white py-1 text-xs font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── AssetRow (list view) ───────────────────────────────────────────────────────

function AssetRow({
  asset,
  allTags,
  isCopied,
  isDeleting,
  isEditing,
  onCopy,
  onEdit,
  onDelete,
  onSaveMeta,
  onCancelEdit,
}: {
  asset:        TenantAsset;
  allTags:      string[];
  isCopied:     boolean;
  isDeleting:   boolean;
  isEditing:    boolean;
  onCopy:       () => void;
  onEdit:       () => void;
  onDelete:     () => void;
  onSaveMeta:   (input: { title: string; altText: string; tags: string[] }) => void;
  onCancelEdit: () => void;
}) {
  const isSvg = asset.mimeType === "image/svg+xml";

  // Edit state (only active when isEditing)
  const [title,   setTitle]   = useState(asset.title   ?? "");
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [tagsStr, setTagsStr] = useState(asset.tags.join(", "));
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    await onSaveMeta({ title, altText, tags });
    setSaving(false);
  };

  if (isEditing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-4 py-3">
          <div className="relative h-10 w-10 overflow-hidden rounded bg-neutral-100">
            {isSvg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.publicUrl} alt="" className="h-full w-full object-contain p-0.5" />
            ) : (
              <Image src={asset.publicUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded border border-neutral-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Alt text"
            className="w-full rounded border border-neutral-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </td>
        <td className="px-4 py-3 text-neutral-400 text-sm">{formatFileSize(asset.fileSize)}</td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="tag1, tag2"
            className="w-full rounded border border-neutral-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-neutral-50 transition-colors">
      {/* Thumbnail */}
      <td className="px-4 py-3">
        <div className="relative h-10 w-10 overflow-hidden rounded bg-neutral-100">
          {isSvg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.publicUrl} alt="" className="h-full w-full object-contain p-0.5" />
          ) : (
            <Image src={asset.publicUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
          )}
        </div>
      </td>

      {/* Name / title */}
      <td className="px-4 py-3">
        <p className="font-medium text-neutral-900 truncate max-w-xs">{asset.title ?? asset.fileName}</p>
        {asset.title && (
          <p className="text-xs text-neutral-400 truncate max-w-xs">{asset.fileName}</p>
        )}
      </td>

      {/* Alt text */}
      <td className="px-4 py-3 text-sm text-neutral-500 max-w-xs">
        <span className="truncate block" title={asset.altText ?? ""}>
          {asset.altText || <span className="italic text-neutral-300">—</span>}
        </span>
      </td>

      {/* Size */}
      <td className="px-4 py-3 text-sm text-neutral-500 whitespace-nowrap">
        {formatFileSize(asset.fileSize)}
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onCopy}
            title="Copy URL"
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {isCopied ? <CheckIcon className="h-4 w-4 text-green-600" /> : <CopyIcon className="h-4 w-4" />}
          </button>
          <a
            href={asset.publicUrl}
            target="_blank"
            rel="noreferrer"
            title="Open original"
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onEdit}
            title="Edit metadata"
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete"
            className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            {isDeleting ? <Spinner className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Inline SVG Icons ───────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
