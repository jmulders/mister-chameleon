"use client";

/**
 * AssetPickerModal
 *
 * Compact modal for selecting a tenant asset from the asset library.
 * Used in block editors and layout variant image fields.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <AssetPickerModal
 *     tenantId="your-tenant-id"
 *     onSelect={(asset) => { setImageUrl(asset.publicUrl); setAlt(asset.altText ?? ""); }}
 *     trigger={<button>Pick image</button>}
 *   />
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   The modal is opened by the trigger element.
 *   On open, it fetches assets for the tenant via the provided `loadAssets` action.
 *   On asset selection, it calls `onSelect` with the selected asset and closes.
 *
 * ─── External URL fallback ────────────────────────────────────────────────────
 *
 *   The "External URL" tab lets users enter any URL instead of picking from the
 *   library. This preserves backward-compatibility with URL-only content.
 */

import { useState, useEffect, useCallback } from "react";
import Image                                from "next/image";
import type { TenantAsset }                 from "@/lib/assets/tenant-assets";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedAsset {
  publicUrl:    string;
  altText:      string;
  title:        string;
  mimeType:     string | null;
  width:        number | null;
  height:       number | null;
  assetId:      string;
}

interface AssetPickerModalProps {
  /** The tenant scope for the asset library. */
  tenantId: string;
  /**
   * Called when the user selects an asset.
   * For external URL: assetId is "" and publicUrl is the typed URL.
   */
  onSelect: (asset: SelectedAsset) => void;
  /**
   * Trigger element — clicking it opens the modal.
   * Can be a button, icon, thumbnail, or any React element.
   */
  trigger: React.ReactElement;
  /**
   * Server action to load assets for the given tenantId.
   * Injected by the parent server component to avoid client→server import issues.
   */
  loadAssets: (tenantId: string) => Promise<TenantAsset[]>;
  /** Currently selected URL, used to highlight the active asset. */
  currentUrl?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssetPickerModal({
  tenantId,
  onSelect,
  trigger,
  loadAssets,
  currentUrl,
}: AssetPickerModalProps) {
  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState<"library" | "external">("library");
  const [assets,     setAssets]     = useState<TenantAsset[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalAlt, setExternalAlt] = useState("");

  // Load assets when modal opens.
  const fetchAssets = useCallback(async () => {
    if (assets.length > 0) return; // cache
    setLoading(true);
    try {
      const list = await loadAssets(tenantId);
      setAssets(list);
    } finally {
      setLoading(false);
    }
  }, [tenantId, loadAssets, assets.length]);

  useEffect(() => {
    if (open && tab === "library") {
      fetchAssets();
    }
  }, [open, tab, fetchAssets]);

  // Filtered assets (client-side search).
  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (a.title       ?? "").toLowerCase().includes(term) ||
      (a.fileName    ?? "").toLowerCase().includes(term) ||
      (a.altText     ?? "").toLowerCase().includes(term)
    );
  });

  function handleSelect(asset: TenantAsset) {
    onSelect({
      publicUrl: asset.publicUrl,
      altText:   asset.altText  ?? "",
      title:     asset.title    ?? asset.fileName,
      mimeType:  asset.mimeType,
      width:     asset.width,
      height:    asset.height,
      assetId:   asset.id,
    });
    setOpen(false);
  }

  function handleExternalConfirm() {
    if (!externalUrl.trim()) return;
    onSelect({
      publicUrl: externalUrl.trim(),
      altText:   externalAlt.trim(),
      title:     externalAlt.trim() || externalUrl.trim(),
      mimeType:  null,
      width:     null,
      height:    null,
      assetId:   "",
    });
    setOpen(false);
  }

  function handleRefresh() {
    setAssets([]);
    setLoading(true);
    loadAssets(tenantId).then((list) => {
      setAssets(list);
      setLoading(false);
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger */}
      <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
        {trigger}
      </span>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">Select image</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 px-5">
              {(["library", "external"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {t === "library" ? "Asset library" : "External URL"}
                </button>
              ))}
            </div>

            {/* Library tab */}
            {tab === "library" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search bar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assets…"
                    className="flex-1 rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    onClick={handleRefresh}
                    className="text-xs text-neutral-400 hover:text-neutral-600 px-2"
                    title="Refresh list"
                  >
                    ↻
                  </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-32 text-xs text-neutral-400">
                      Loading assets…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-xs text-neutral-400">
                      {search ? "No assets match your search." : "No assets in library yet."}
                      {!search && (
                        <a
                          href={`/admin/tenants/${tenantId}/assets`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          Go to Asset Library →
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {filtered.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelect(asset)}
                          className={`group relative rounded-lg border-2 overflow-hidden text-left transition-all hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                            currentUrl === asset.publicUrl
                              ? "border-brand-500 ring-1 ring-brand-300"
                              : "border-neutral-200"
                          }`}
                          title={asset.title ?? asset.fileName}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-full aspect-square bg-neutral-100">
                            {asset.mimeType?.startsWith("image/") ? (
                              <Image
                                src={asset.publicUrl}
                                alt={asset.altText ?? asset.fileName}
                                fill
                                className="object-cover"
                                sizes="128px"
                                unoptimized={asset.publicUrl.includes(".svg")}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-2xl text-neutral-300">
                                🖼
                              </div>
                            )}
                            {currentUrl === asset.publicUrl && (
                              <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-brand-600 flex items-center justify-center">
                                <span className="text-white text-[9px] font-bold">✓</span>
                              </div>
                            )}
                          </div>
                          {/* Label */}
                          <div className="px-2 py-1.5">
                            <p className="text-[11px] font-medium text-neutral-700 truncate">
                              {asset.title ?? asset.fileName}
                            </p>
                            {asset.altText && (
                              <p className="text-[10px] text-neutral-400 truncate">{asset.altText}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 text-xs text-neutral-400">
                  <span>{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</span>
                  <a
                    href={`/admin/tenants/${tenantId}/assets`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Manage assets →
                  </a>
                </div>
              </div>
            )}

            {/* External URL tab */}
            {tab === "external" && (
              <div className="flex flex-col gap-4 p-5 flex-1">
                <p className="text-xs text-neutral-500">
                  Enter any image URL. This preserves backward-compatibility with
                  content created before the asset library.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Image URL</label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Alt text</label>
                    <input
                      type="text"
                      value={externalAlt}
                      onChange={(e) => setExternalAlt(e.target.value)}
                      placeholder="Describe the image for screen readers"
                      className="w-full rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  {externalUrl && (
                    <div className="relative w-full max-w-xs aspect-video rounded bg-neutral-100 overflow-hidden">
                      <Image
                        src={externalUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                        sizes="320px"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={handleExternalConfirm}
                    disabled={!externalUrl.trim()}
                    className="rounded bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    Use this URL
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
