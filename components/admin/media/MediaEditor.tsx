"use client";

/**
 * Shared media editor
 *
 * The block media-editing cluster, relocated verbatim from EditBlockDrawer so it
 * can be reused by the form contact-panel editors as well. Exports:
 *
 *   SlideMediaEditor - self-contained image/video editor that emits a
 *                      HeroBannerMedia (image: asset library / URL; video:
 *                      upload / YouTube / Vimeo with autoplay / loop / poster).
 *   ImagePicker      - asset-library image picker + focal point + alt text.
 *   VideoOptions     - source-specific video fields + common toggles.
 *
 * Behavior is identical to the previous inline definitions; the drawer imports
 * these instead of defining them, so block editing is unchanged.
 */

import { useState, useEffect, useRef } from "react";
import { loadAssetsForPickerAction } from "@/lib/assets/asset-picker-action";
import { uploadForPickerClient }      from "@/lib/assets/upload-for-picker-client";
import { AssetPickerModal }           from "@/components/admin/AssetPickerModal";
import type {
  HeroBannerImage,
  HeroBannerVideoUpload,
  HeroBannerVideoYouTube,
  HeroBannerVideoVimeo,
  HeroBannerMedia,
} from "@/cms/types";

export type VideoSource = "upload" | "youtube" | "vimeo";

const INPUT_CLS =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

const TOGGLE_BTN = (active: boolean) =>
  [
    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-brand-400 bg-brand-50 text-brand-700"
      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
  ].join(" ");

// ── Small toggle ────────────────────────────────────────────────────────────────

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={[
          "relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 transition-colors",
          value ? "border-brand-500 bg-brand-500" : "border-neutral-300 bg-neutral-200",
        ].join(" ")}
      >
        <span className={[
          "absolute top-0 h-3 w-3 rounded-full bg-white shadow transition-transform",
          value ? "translate-x-3" : "translate-x-0",
        ].join(" ")} />
      </div>
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
    </label>
  );
}

// ── Image picker ────────────────────────────────────────────────────────────────

/** 3x3 focal-point grid to CSS object-position keyword. */
const FOCAL_POINTS: { value: string; label: string }[] = [
  { value: "left top",    label: "Top left" },     { value: "center top",    label: "Top" },     { value: "right top",    label: "Top right" },
  { value: "left center", label: "Left" },         { value: "center",        label: "Center" },  { value: "right center", label: "Right" },
  { value: "left bottom", label: "Bottom left" },  { value: "center bottom", label: "Bottom" },   { value: "right bottom", label: "Bottom right" },
];

export function ImagePicker({
  tenantId,
  url,
  alt,
  objectPosition,
  onUrlChange,
  onAltChange,
  onObjectPositionChange,
}: {
  tenantId: string;
  url: string;
  alt: string;
  /** Current object-position; the focal-point grid only shows when a change handler is passed. */
  objectPosition?: string;
  onUrlChange: (v: string) => void;
  onAltChange: (v: string) => void;
  onObjectPositionChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Picker trigger */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1.5">Image</label>
        <AssetPickerModal
          tenantId={tenantId}
          loadAssets={loadAssetsForPickerAction}
          uploadAsset={uploadForPickerClient}
          onSelect={(asset) => { onUrlChange(asset.publicUrl); onAltChange(asset.altText ?? ""); }}
          currentUrl={url}
          trigger={
            url ? (
              <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-neutral-200 h-28 bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={alt || "Selected image"}
                  className="w-full h-full object-cover"
                  style={{ objectPosition }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <span className="text-white text-xs font-semibold">Change image</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-xs font-medium text-neutral-500 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 5 2-3 3 6z" clipRule="evenodd"/>
                </svg>
                Pick from library or enter URL
              </button>
            )
          }
        />
        {url && (
          <button
            type="button"
            onClick={() => { onUrlChange(""); onAltChange(""); }}
            className="mt-1 text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
          >
            Remove image
          </button>
        )}
      </div>

      {/* Focal point: which part stays in view when the hero crops the image */}
      {url && onObjectPositionChange && (
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Focal point</label>
          <div className="grid w-[4.5rem] grid-cols-3 gap-1">
            {FOCAL_POINTS.map((fp) => {
              const active = (objectPosition || "center") === fp.value;
              return (
                <button
                  key={fp.value}
                  type="button"
                  title={fp.label}
                  aria-label={`Focal point: ${fp.label}`}
                  aria-pressed={active}
                  onClick={() => onObjectPositionChange(fp.value)}
                  className={`aspect-square rounded-sm border transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-500"
                      : "border-neutral-300 bg-neutral-100 hover:border-brand-400"
                  }`}
                />
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-neutral-400">
            Keeps the subject in frame when the hero crops the image (e.g. full-height backgrounds).
          </p>
        </div>
      )}

      {/* Alt text */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">Alt text</label>
        <input
          type="text"
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder="Describe the image for screen readers"
          className={INPUT_CLS}
        />
      </div>
    </div>
  );
}

// ── Video options (autoplay / loop and source-specific) ─────────────────────────

export function VideoOptions({
  source,
  tenantId,
  videoUrl,
  videoPoster,
  videoId,
  autoplay,
  loop,
  muted,
  controls,
  onVideoUrl:    setVideoUrl,
  onVideoPoster: setVideoPoster,
  onVideoId:     setVideoId,
  onAutoplay:    setAutoplay,
  onLoop:        setLoop,
  onMuted:       setMuted,
  onControls:    setControls,
}: {
  source:       VideoSource;
  tenantId:     string;
  videoUrl:     string;
  videoPoster:  string;
  videoId:      string;
  autoplay:     boolean;
  loop:         boolean;
  muted:        boolean;
  controls:     boolean;
  onVideoUrl:    (v: string) => void;
  onVideoPoster: (v: string) => void;
  onVideoId:     (v: string) => void;
  onAutoplay:    (v: boolean) => void;
  onLoop:        (v: boolean) => void;
  onMuted:       (v: boolean) => void;
  onControls:    (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {source === "upload" && (
        <>
          {/* Video picker: same UX as ImagePicker but mode="video" */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Video</label>
            <AssetPickerModal
              tenantId={tenantId}
              loadAssets={loadAssetsForPickerAction}
              uploadAsset={uploadForPickerClient}
              mode="video"
              onSelect={(asset) => setVideoUrl(asset.publicUrl)}
              currentUrl={videoUrl}
              trigger={
                videoUrl ? (
                  <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-neutral-200 h-20 bg-neutral-900 flex items-center gap-3 px-4">
                    <svg className="h-8 w-8 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                    </svg>
                    <span className="text-xs text-neutral-300 truncate flex-1 text-left">
                      {videoUrl.split("/").pop() ?? videoUrl}
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-semibold">Change video</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-xs font-medium text-neutral-500 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Pick from library or upload
                  </button>
                )
              }
            />
            {videoUrl && (
              <button
                type="button"
                onClick={() => setVideoUrl("")}
                className="mt-1 text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
              >
                Remove video
              </button>
            )}
          </div>

          {/* Poster thumbnail */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Poster / thumbnail <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <AssetPickerModal
              tenantId={tenantId}
              loadAssets={loadAssetsForPickerAction}
              uploadAsset={uploadForPickerClient}
              onSelect={(asset) => setVideoPoster(asset.publicUrl)}
              currentUrl={videoPoster}
              trigger={
                videoPoster ? (
                  <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-neutral-200 h-16 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={videoPoster} alt="Poster" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-[10px] font-semibold">Change</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 5 2-3 3 6z" clipRule="evenodd"/>
                    </svg>
                    Pick poster image from library
                  </button>
                )
              }
            />
            {videoPoster && (
              <button
                type="button"
                onClick={() => setVideoPoster("")}
                className="mt-0.5 text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
              >
                Remove poster
              </button>
            )}
          </div>
        </>
      )}

      {(source === "youtube" || source === "vimeo") && (
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            {source === "youtube" ? "YouTube" : "Vimeo"} video ID
          </label>
          <input
            type="text"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value.trim())}
            placeholder={source === "youtube" ? "dQw4w9WgXcQ" : "123456789"}
            className={INPUT_CLS}
          />
          <p className="mt-0.5 text-[10px] text-neutral-400">
            {source === "youtube"
              ? "The ID from the URL: youtube.com/watch?v= ··· dQw4w9WgXcQ"
              : "The numeric ID from: vimeo.com/ ··· 123456789"}
          </p>
        </div>
      )}

      {/* Common options */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
        <Toggle label="Autoplay" value={autoplay} onChange={setAutoplay} />
        <Toggle label="Loop"     value={loop}     onChange={setLoop} />
        {source === "upload" && (
          <>
            <Toggle label="Muted"    hint="required for autoplay" value={muted}    onChange={setMuted} />
            <Toggle label="Controls" hint="show player controls"  value={controls} onChange={setControls} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Per-item media editor ───────────────────────────────────────────────────────

/**
 * Self-contained media editor. Reuses ImagePicker and VideoOptions, manages its
 * own form state initialised from the incoming `media`, and emits an assembled
 * HeroBannerMedia (or undefined) via `onChange` whenever anything changes.
 * Image (asset library / URL) or video (upload / YouTube / Vimeo) with autoplay /
 * loop / muted / poster.
 */
export function SlideMediaEditor({
  tenantId,
  media,
  onChange,
}: {
  tenantId: string;
  media:    HeroBannerMedia | undefined;
  onChange: (m: HeroBannerMedia | undefined) => void;
}) {
  const initImg = media?.kind === "image" ? media : undefined;
  const initVid = media?.kind === "video" ? media.video : undefined;

  const [mediaType, setMediaType]     = useState<"none" | "image" | "video">(media?.kind ?? "none");
  const [imageUrl, setImageUrl]       = useState(initImg?.url ?? "");
  const [imageAlt, setImageAlt]       = useState(initImg?.alt ?? "");
  const [videoSource, setVideoSource] = useState<VideoSource>(initVid?.source ?? "upload");
  const [videoUrl, setVideoUrl]       = useState(initVid?.source === "upload" ? initVid.url : "");
  const [videoPoster, setVideoPoster] = useState(initVid?.source === "upload" ? (initVid.poster ?? "") : "");
  const [videoId, setVideoId]         = useState(
    initVid?.source === "youtube" || initVid?.source === "vimeo" ? initVid.videoId : "",
  );
  const [autoplay, setAutoplay]       = useState(initVid?.autoplay ?? false);
  const [loop, setLoop]               = useState(initVid?.loop ?? false);
  const [muted, setMuted]             = useState(initVid?.source === "upload" ? (initVid.muted ?? true) : true);
  const [controls, setControls]       = useState(initVid?.source === "upload" ? (initVid.controls ?? true) : true);

  // The parent passes a fresh onChange closure each render; keep it in a ref so
  // the emit effect depends only on the actual media values (no feedback loop).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let next: HeroBannerMedia | undefined;
    if (mediaType === "image" && imageUrl) {
      next = { kind: "image", url: imageUrl, alt: imageAlt } satisfies HeroBannerImage;
    } else if (mediaType === "video") {
      if (videoSource === "upload" && videoUrl) {
        next = {
          kind: "video",
          video: {
            source: "upload",
            url:    videoUrl,
            ...(videoPoster ? { poster: videoPoster } : {}),
            autoplay,
            loop,
            muted,
            controls,
          } satisfies HeroBannerVideoUpload,
        };
      } else if (videoSource === "youtube" && videoId) {
        next = {
          kind: "video",
          video: { source: "youtube", videoId, ...(autoplay ? { autoplay: true } : {}), ...(loop ? { loop: true } : {}) } satisfies HeroBannerVideoYouTube,
        };
      } else if (videoSource === "vimeo" && videoId) {
        next = {
          kind: "video",
          video: { source: "vimeo", videoId, ...(autoplay ? { autoplay: true } : {}), ...(loop ? { loop: true } : {}) } satisfies HeroBannerVideoVimeo,
        };
      }
    }
    onChangeRef.current(next);
  }, [mediaType, imageUrl, imageAlt, videoSource, videoUrl, videoPoster, videoId, autoplay, loop, muted, controls]);

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="flex gap-2">
        {(["none", "image", "video"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setMediaType(t)} className={TOGGLE_BTN(mediaType === t)}>
            {t === "none" ? "None" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {mediaType === "image" && (
        <ImagePicker
          tenantId={tenantId}
          url={imageUrl}
          alt={imageAlt}
          onUrlChange={setImageUrl}
          onAltChange={setImageAlt}
        />
      )}

      {mediaType === "video" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Video source</label>
            <div className="flex gap-1.5">
              {(["upload", "youtube", "vimeo"] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setVideoSource(src)}
                  className={[
                    "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                    videoSource === src
                      ? "border-neutral-800 bg-neutral-800 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
                  ].join(" ")}
                >
                  {src === "upload" ? "Upload" : src.charAt(0).toUpperCase() + src.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <VideoOptions
            source={videoSource}
            tenantId={tenantId}
            videoUrl={videoUrl}
            videoPoster={videoPoster}
            videoId={videoId}
            autoplay={autoplay}
            loop={loop}
            muted={muted}
            controls={controls}
            onVideoUrl={setVideoUrl}
            onVideoPoster={setVideoPoster}
            onVideoId={setVideoId}
            onAutoplay={setAutoplay}
            onLoop={setLoop}
            onMuted={setMuted}
            onControls={setControls}
          />
        </div>
      )}
    </div>
  );
}
