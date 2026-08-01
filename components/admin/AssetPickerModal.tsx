"use client";

/**
 * AssetPickerModal
 *
 * Compact modal for selecting a tenant asset.
 *
 * Three tabs:
 *   Library  — grid of existing tenant assets (searchable)
 *   Upload   — upload a new file, immediately select it on success
 *   URL      — enter any external URL as fallback
 *
 * The "Upload" tab is shown only when an `uploadAsset` action is provided.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Image                                         from "next/image";
import type { TenantAsset }                          from "@/lib/assets/tenant-assets";
import type { PickerUploadResult }                   from "@/lib/assets/upload-for-picker-action";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedAsset {
  publicUrl: string;
  altText:   string;
  title:     string;
  mimeType:  string | null;
  width:     number | null;
  height:    number | null;
  assetId:   string;
}

interface AssetPickerModalProps {
  tenantId:    string;
  onSelect:    (asset: SelectedAsset) => void;
  trigger:     React.ReactElement;
  loadAssets:  (tenantId: string) => Promise<TenantAsset[]>;
  uploadAsset?: (formData: FormData) => Promise<PickerUploadResult>;
  currentUrl?: string;
  /** Controls accepted file types, previews, and library filtering. Default: "image" */
  mode?:       "image" | "video";
}

type Tab = "library" | "upload" | "external";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const VIDEO_MIMES = "video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/mpeg";
const IMAGE_MIMES = "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml";

export function AssetPickerModal({
  tenantId,
  onSelect,
  trigger,
  loadAssets,
  uploadAsset,
  currentUrl,
  mode = "image",
}: AssetPickerModalProps) {
  const isVideo = mode === "video";
  const [open, setOpen]   = useState(false);
  const [tab,  setTab]    = useState<Tab>("library");

  // ── Library state ─────────────────────────────────────────────────────────

  const [assets,  setAssets]  = useState<TenantAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");

  const fetchAssets = useCallback(async (force = false) => {
    if (!force && assets.length > 0) return;
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

  const filtered = assets.filter((a) => {
    // In video mode only show video assets; in image mode show everything.
    if (isVideo) {
      const looksLikeVideo =
        a.mimeType?.startsWith("video/") ||
        a.assetType === "video" ||
        /\.(mp4|webm|mov|avi|ogv|mpeg)$/i.test(a.fileName ?? "");
      if (!looksLikeVideo) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.title    ?? "").toLowerCase().includes(q) ||
      (a.fileName ?? "").toLowerCase().includes(q) ||
      (a.altText  ?? "").toLowerCase().includes(q)
    );
  });

  function handleSelectAsset(asset: TenantAsset) {
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

  // ── Upload state ──────────────────────────────────────────────────────────

  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [pickedFile,  setPickedFile]  = useState<File | null>(null);
  const [altText,     setAltText]     = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview,     setPreview]     = useState<string | null>(null);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPickedFile(f);
    setUploadError(null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleUpload() {
    if (!pickedFile || !uploadAsset) return;
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file",     pickedFile);
    fd.append("tenantId", tenantId);
    if (altText.trim()) fd.append("altText", altText.trim());

    const result = await uploadAsset(fd);
    setUploading(false);

    if (!result.ok) {
      setUploadError(result.error);
      return;
    }

    // Add the new asset to the local list so library tab shows it.
    setAssets((prev) => [result.asset, ...prev]);

    // Immediately select it and close.
    onSelect({
      publicUrl: result.asset.publicUrl,
      altText:   result.asset.altText  ?? altText.trim(),
      title:     result.asset.title    ?? result.asset.fileName,
      mimeType:  result.asset.mimeType,
      width:     result.asset.width,
      height:    result.asset.height,
      assetId:   result.asset.id,
    });
    setOpen(false);

    // Reset upload form.
    setPickedFile(null);
    setAltText("");
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── External URL state ────────────────────────────────────────────────────

  const [externalUrl, setExternalUrl] = useState("");
  const [externalAlt, setExternalAlt] = useState("");

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

  // ── Available tabs ────────────────────────────────────────────────────────

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "library",  label: "Library" },
    ...(uploadAsset ? [{ key: "upload" as Tab, label: "Upload" }] : []),
    { key: "external", label: "URL" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
        {trigger}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 shrink-0">
              <h2 className="text-base font-semibold text-neutral-900">{isVideo ? "Select video" : "Select image"}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 px-5 shrink-0">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                    tab === t.key
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-neutral-500 hover:text-neutral-700",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Library tab ──────────────────────────────────────────── */}
            {tab === "library" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 shrink-0">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assets…"
                    className="flex-1 rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {uploadAsset && (
                    <button
                      onClick={() => setTab("upload")}
                      className="shrink-0 flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 11V1M4 4l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M1 13v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" strokeLinecap="round"/>
                      </svg>
                      Upload new
                    </button>
                  )}
                  <button
                    onClick={() => fetchAssets(true)}
                    className="text-xs text-neutral-400 hover:text-neutral-600 px-1.5"
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
                      {search
                        ? "No assets match your search."
                        : isVideo
                          ? "No video assets in library yet."
                          : "No assets in library yet. Upload one to get started."}
                      {!search && uploadAsset && (
                        <button
                          onClick={() => setTab("upload")}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          {isVideo ? "Upload first video →" : "Upload first image →"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {filtered.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelectAsset(asset)}
                          className={[
                            "group relative rounded-lg border-2 overflow-hidden text-left transition-all hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400",
                            currentUrl === asset.publicUrl
                              ? "border-brand-500 ring-1 ring-brand-300"
                              : "border-neutral-200",
                          ].join(" ")}
                          title={asset.title ?? asset.fileName}
                        >
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
                            ) : asset.mimeType?.startsWith("video/") ? (
                              <div className="flex flex-col items-center justify-center h-full gap-1 bg-neutral-900">
                                <svg className="h-7 w-7 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" className="text-neutral-500"/>
                                </svg>
                                <span className="text-[9px] text-neutral-500 px-1 truncate w-full text-center">
                                  {asset.fileName}
                                </span>
                              </div>
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
                <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 text-xs text-neutral-400 shrink-0">
                  <span>{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</span>
                  <a
                    href={`/admin/tenants/${tenantId}/content/assets`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Manage assets →
                  </a>
                </div>
              </div>
            )}

            {/* ── Upload tab ────────────────────────────────────────────── */}
            {tab === "upload" && uploadAsset && (
              <div className="flex flex-col gap-5 p-6 flex-1 overflow-y-auto">

                {/* Drop / click zone */}
                <div>
                  <label
                    htmlFor="picker-upload-file"
                    className={[
                      "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                      pickedFile
                        ? "border-brand-400 bg-brand-50/40 py-4"
                        : "border-neutral-300 bg-neutral-50 py-10 hover:border-brand-400 hover:bg-brand-50/30",
                    ].join(" ")}
                  >
                    {pickedFile && preview ? (
                      <div className="flex items-center gap-4 px-4 w-full">
                        {pickedFile.type.startsWith("video/") ? (
                          /* eslint-disable-next-line jsx-a11y/media-has-caption */
                          <video
                            src={preview}
                            className="h-20 w-20 rounded-lg object-cover border border-neutral-200 shrink-0 bg-neutral-900"
                            preload="metadata"
                            muted
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={preview}
                            alt="Preview"
                            className="h-20 w-20 rounded-lg object-cover border border-neutral-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-800 truncate">{pickedFile.name}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{formatBytes(pickedFile.size)}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setPickedFile(null);
                              setPreview(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="mt-1 text-[11px] text-neutral-400 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg className="h-8 w-8 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-medium text-neutral-700">Click to choose a file</p>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {isVideo
                              ? "MP4, WebM, MOV · max 200 MB"
                              : "JPEG, PNG, WebP, GIF, SVG · max 10 MB"}
                          </p>
                        </div>
                      </>
                    )}
                    <input
                      id="picker-upload-file"
                      ref={fileInputRef}
                      type="file"
                      accept={isVideo ? VIDEO_MIMES : IMAGE_MIMES}
                      className="sr-only"
                      onChange={handleFilePick}
                    />
                  </label>
                </div>

                {/* Alt text */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-700">
                    {isVideo ? "Title" : "Alt text"}{" "}
                    <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder={isVideo ? "Short description of the video" : "Describe the image for screen readers"}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Error */}
                {uploadError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {uploadError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 mt-auto">
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!pickedFile || uploading}
                    className={[
                      "rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
                      !pickedFile || uploading
                        ? "cursor-not-allowed bg-brand-300"
                        : "bg-brand-500 hover:bg-brand-600",
                    ].join(" ")}
                  >
                    {uploading ? "Uploading…" : "Upload & select"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("library")}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                  >
                    Back to library
                  </button>
                </div>
              </div>
            )}

            {/* ── External URL tab ──────────────────────────────────────── */}
            {tab === "external" && (
              <div className="flex flex-col gap-4 p-5 flex-1">
                <p className="text-xs text-neutral-500">
                  {isVideo
                    ? "Enter a direct video URL. Useful for videos hosted on your CDN, storage, or Supabase."
                    : "Enter any image URL. Useful for images hosted on your CDN, CMS, or external source."}
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">
                      {isVideo ? "Video URL" : "Image URL"}
                    </label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder={isVideo ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
                      className="w-full rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      autoFocus
                    />
                  </div>
                  {!isVideo && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Alt text</label>
                      <input
                        type="text"
                        value={externalAlt}
                        onChange={(e) => setExternalAlt(e.target.value)}
                        placeholder="Describe the image"
                        className="w-full rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  )}
                  {externalUrl && !isVideo && (
                    <div className="relative w-full max-w-xs aspect-video rounded bg-neutral-100 overflow-hidden">
                      {/* External URLs can be ANY domain, so next/image's domain
                          allowlist would block the preview. A plain <img> shows
                          any reachable URL (the public site also renders these
                          via <img>). Note: some hosts block hot-linking, in which
                          case the image won't load anywhere, not just here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={externalUrl}
                        alt="Preview"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                  )}
                  {externalUrl && isVideo && (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
                    <video
                      src={externalUrl}
                      className="w-full max-w-xs rounded bg-neutral-900"
                      preload="metadata"
                      controls
                    />
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
