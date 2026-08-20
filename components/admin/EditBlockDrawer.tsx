"use client";

/**
 * EditBlockDrawer
 *
 * Slide-over panel for editing an AdaptiveBlockData record.
 *
 * Media section supports:
 *   Image  — pick from tenant asset library or enter external URL
 *   Video  — three sources:
 *              upload   : URL (or asset library video) + poster image + autoplay/loop/muted/controls
 *              youtube  : video ID + autoplay/loop
 *              vimeo    : video ID + autoplay/loop
 */

import { useState, useTransition, useEffect, useRef } from "react";
import { upsertAdaptiveBlockAction }             from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { loadAssetsForPickerAction }             from "@/lib/assets/asset-picker-action";
import { uploadForPickerClient }                 from "@/lib/assets/upload-for-picker-client";
import { AssetPickerModal }                      from "@/components/admin/AssetPickerModal";
import type {
  AdaptiveBlockData,
  AdaptiveVariantContent,
  AdaptiveVariantItem,
  HeroSlideData,
  HeroBannerImage,
  HeroBannerVideo,
  HeroBannerVideoUpload,
  HeroBannerVideoYouTube,
  HeroBannerVideoVimeo,
  HeroBannerMedia,
  NotificationPosition,
} from "@/cms/types";
import type { NotificationFrequency, NotificationTtlUnit } from "@/lib/notifications/frequency-cap";
import type {
  VariantDecisionMeta,
  IntentLevel,
  FunnelStage,
  VisitorSource,
  VariantTone,
} from "@/ai/variant-meta";
import type { BlockTokenSet, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import { BLOCK_TOKEN_GROUPS, VALID_SURFACE_ROLES } from "@/design-system/theme/block-token-set";
import { buildBlockPreviewSrc } from "@/lib/blocks/block-preview-url";
import { normalizeInlineMarkup } from "@/lib/blocks/inline-markup";
import { RichCopyEditor } from "@/components/admin/RichCopyEditor";

// ── AI / Decision option lists ──────────────────────────────────────────────────

const INTENT_LEVELS:  IntentLevel[]   = ["awareness", "consideration", "decision"];
const FUNNEL_STAGES:  FunnelStage[]   = ["awareness", "consideration", "decision", "retention"];
const VISITOR_SOURCES: VisitorSource[] = ["google", "linkedin", "direct", "unknown"];
const VARIANT_TONES:  VariantTone[]   = ["educational", "inspiring", "direct", "persuasive", "credibility", "urgency"];

// ── Types ──────────────────────────────────────────────────────────────────────

interface CTA {
  label:   string;
  href:    string;
  variant: "primary" | "secondary" | "outline" | "ghost";
}

type VideoSource = "upload" | "youtube" | "vimeo";

// ── Layout variant options per slot ────────────────────────────────────────────

const LAYOUT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  hero: [
    { value: "default",           label: "Default" },
    { value: "hero_split",        label: "Split" },
    { value: "hero_proof",        label: "With proof bar" },
    { value: "hero_background",   label: "Background image" },
    { value: "hero_minimal_dark", label: "Minimal dark" },
    { value: "hero_split_clean",  label: "Split clean" },
    { value: "hero_dark_split",   label: "Dark split" },
    { value: "hero_editorial",    label: "Editorial" },
    { value: "hero_carousel",     label: "Carousel" },
  ],
  proof: [
    { value: "proof_stats",     label: "Stats" },
    { value: "proof_logos",     label: "Logo strip" },
    { value: "proof_quotes",    label: "Quotes" },
    { value: "proof_spotlight", label: "Spotlight (media beside text)" },
  ],
  cta: [
    { value: "cta_banner",         label: "Banner" },
    { value: "cta_banner_default", label: "Banner (default)" },
    { value: "cta_banner_compact", label: "Banner compact" },
    { value: "cta_split",          label: "Split" },
    { value: "cta_card",           label: "Card" },
    { value: "cta_soft",           label: "Soft" },
    { value: "cta_glow",           label: "Glow" },
    { value: "cta_media_first",    label: "Media first" },
  ],
  feature: [
    { value: "feature_grid_3up",       label: "Grid (3 columns)" },
    { value: "feature_grid_4up",       label: "Grid (4 columns)" },
    { value: "feature_grid_cards",     label: "Cards" },
    { value: "feature_grid_checklist", label: "Checklist" },
    { value: "feature_grid_spacious",  label: "Spacious" },
    { value: "feature_grid_dark",      label: "Dark" },
    { value: "feature_spotlight",      label: "Spotlight (media beside text)" },
  ],
  conversion: [
    { value: "conversion_cta",  label: "CTA" },
    { value: "conversion_form", label: "Form" },
  ],
  notification: [
    { value: "notification_bar",   label: "Bar" },
    { value: "notification_modal", label: "Modal" },
  ],
};

// ── Block-specific design-token groups ─────────────────────────────────────────
// Most token groups (colour, text, buttons, typography…) apply to any block, but
// a few groups only affect one block type. When editing a hero we shouldn't show
// the proof/feature/CTA token groups (and vice versa) — only the group for the
// current slot, plus all the universal groups.

const SLOT_TOKEN_GROUP: Record<string, string> = {
  hero:    "Hero",
  proof:   "Proof / testimonials",
  feature: "Feature grid",
  cta:     "CTA section",
};
const BLOCK_SPECIFIC_GROUP_TITLES = new Set(Object.values(SLOT_TOKEN_GROUP));

// ── Helpers ────────────────────────────────────────────────────────────────────

function slotFromKey(key: string): string {
  const prefixes = ["hero_", "proof_", "cta_", "feature_", "conversion_", "notification_"];
  for (const p of prefixes) {
    if (key.startsWith(p)) return p.slice(0, -1);
  }
  return "hero";
}

function hasItems(slotId: string): boolean {
  return slotId === "proof" || slotId === "feature";
}

function emptyItem(): AdaptiveVariantItem {
  return { title: "", text: "", imageUrl: "", cta: "", ctaHref: "" };
}

const INPUT_CLS =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const SMALL_INPUT_CLS =
  "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200";
const TOGGLE_BTN = (active: boolean) =>
  [
    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-brand-400 bg-brand-50 text-brand-700"
      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
  ].join(" ");

// ── Sub-component: small toggle ────────────────────────────────────────────────

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

// ── Sub-component: image picker ────────────────────────────────────────────────

/** Reference desktop viewport the block preview renders at, then scales to fit. */
const PREVIEW_VIEWPORT = { width: 1280, height: 720 } as const; // 16:9 desktop

/** 3×3 focal-point grid → CSS object-position keyword. */
const FOCAL_POINTS: { value: string; label: string }[] = [
  { value: "left top",    label: "Top left" },     { value: "center top",    label: "Top" },     { value: "right top",    label: "Top right" },
  { value: "left center", label: "Left" },         { value: "center",        label: "Center" },  { value: "right center", label: "Right" },
  { value: "left bottom", label: "Bottom left" },  { value: "center bottom", label: "Bottom" },   { value: "right bottom", label: "Bottom right" },
];

function ImagePicker({
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

      {/* Focal point — which part stays in view when the hero crops the image */}
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

// ── Sub-component: video options (autoplay / loop and source-specific) ─────────

function VideoOptions({
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
          {/* Video picker — same UX as ImagePicker but mode="video" */}
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
              ? "The ID from the URL: youtube.com/watch?v= ··· dQw4w9WgXcQ"
              : "The numeric ID from: vimeo.com/ ··· 123456789"}
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

// ── Sub-component: per-slide media editor ──────────────────────────────────────

/**
 * Self-contained media editor for a single carousel slide. Reuses ImagePicker
 * and VideoOptions, manages its own form state initialised from the incoming
 * `media`, and emits an assembled HeroBannerMedia (or undefined) via `onChange`
 * whenever anything changes. Gives each slide the SAME media capabilities as the
 * main hero block: image (asset library / URL) or video (upload / YouTube /
 * Vimeo) with autoplay / loop / muted / poster.
 */
function SlideMediaEditor({
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

// ── Sub-component: CTA row ─────────────────────────────────────────────────────

function CtaRow({
  cta,
  idx,
  onChange,
  onRemove,
}: {
  cta:      CTA;
  idx:      number;
  onChange: (idx: number, field: keyof CTA, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500">CTA {idx + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Label</label>
          <input
            type="text"
            value={cta.label}
            onChange={(e) => onChange(idx, "label", e.target.value)}
            placeholder="Get started"
            className={SMALL_INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">URL</label>
          <input
            type="text"
            value={cta.href}
            onChange={(e) => onChange(idx, "href", e.target.value)}
            placeholder="/contact"
            className={SMALL_INPUT_CLS}
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Style</label>
        <select
          value={cta.variant}
          onChange={(e) => onChange(idx, "variant", e.target.value)}
          className={SMALL_INPUT_CLS}
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="outline">Outline</option>
          <option value="ghost">Ghost</option>
        </select>
      </div>
    </div>
  );
}

// ── Sub-component: Item row (proof / feature) ──────────────────────────────────

function ItemRow({
  item,
  idx,
  tenantId,
  slotId,
  onChange,
  onMediaChange,
  onMediaSideChange,
  onRemove,
}: {
  item:          AdaptiveVariantItem;
  idx:           number;
  tenantId:      string;
  slotId:        string;
  onChange:         (idx: number, field: keyof AdaptiveVariantItem, value: string) => void;
  onMediaChange:    (idx: number, media: HeroBannerMedia | undefined) => void;
  onMediaSideChange: (idx: number, side: "left" | "right" | undefined) => void;
  onRemove:         (idx: number) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500">Item {idx + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Title</label>
          <input
            type="text"
            value={item.title ?? ""}
            onChange={(e) => onChange(idx, "title", e.target.value)}
            placeholder="40% higher conversion"
            className={SMALL_INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Image URL</label>
          <input
            type="text"
            value={item.imageUrl ?? ""}
            onChange={(e) => onChange(idx, "imageUrl", e.target.value)}
            placeholder="https://..."
            className={SMALL_INPUT_CLS}
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Text / body</label>
        <RichCopyEditor
          value={item.text ?? item.body ?? ""}
          onChange={(md) => onChange(idx, "text", md)}
          ariaLabel={`Item ${idx + 1} text`}
          placeholder="Supporting copy. Select text to make it bold, italic, or a link."
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">CTA label</label>
          <input
            type="text"
            value={item.cta ?? ""}
            onChange={(e) => onChange(idx, "cta", e.target.value)}
            placeholder="Read more"
            className={SMALL_INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">CTA URL</label>
          <input
            type="text"
            value={item.ctaHref ?? ""}
            onChange={(e) => onChange(idx, "ctaHref", e.target.value)}
            placeholder="/cases/example"
            className={SMALL_INPUT_CLS}
          />
        </div>
      </div>

      {/* ── Spotlight fields (proof_spotlight / feature_spotlight) ──────────── */}
      <details className="rounded-md border border-neutral-200 bg-white p-2">
        <summary className="cursor-pointer text-[11px] font-medium text-neutral-600">
          Spotlight (media + {slotId === "proof" ? "attribution" : "offer"})
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Media</label>
            <SlideMediaEditor
              tenantId={tenantId}
              media={item.media}
              onChange={(m) => onMediaChange(idx, m)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Media side</label>
            <select
              value={item.mediaSide ?? ""}
              onChange={(e) => onMediaSideChange(idx, e.target.value === "" ? undefined : (e.target.value as "left" | "right"))}
              className={SMALL_INPUT_CLS}
            >
              <option value="">Default (inherit)</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
            <p className="mt-1 text-[10px] text-neutral-400">Default follows the tenant setting. Left or right overrides it for this item.</p>
          </div>

          {slotId === "proof" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Name</label>
                <input type="text" value={item.name ?? ""} onChange={(e) => onChange(idx, "name", e.target.value)} placeholder="Marien de Vries" className={SMALL_INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Role</label>
                <input type="text" value={item.role ?? ""} onChange={(e) => onChange(idx, "role", e.target.value)} placeholder="Eigenaar" className={SMALL_INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Organisation</label>
                <input type="text" value={item.organisation ?? ""} onChange={(e) => onChange(idx, "organisation", e.target.value)} placeholder="Transport Jansen" className={SMALL_INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Kind (eyebrow)</label>
                <select value={item.kind ?? ""} onChange={(e) => onChange(idx, "kind", e.target.value)} className={SMALL_INPUT_CLS}>
                  <option value="">None</option>
                  <option value="klant">klant</option>
                  <option value="partner">partner</option>
                  <option value="leverancier">leverancier</option>
                  <option value="medewerker">medewerker</option>
                </select>
              </div>
            </div>
          )}

          {slotId === "feature" && (
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Price (optional)</label>
              <input type="text" value={item.price ?? ""} onChange={(e) => onChange(idx, "price", e.target.value)} placeholder="vanaf €1.250" className={SMALL_INPUT_CLS} />
              <p className="mt-1 text-[10px] text-neutral-400">The offer CTA uses the CTA label + URL above. Price and CTA are each optional.</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// ── EditBlockDrawer ────────────────────────────────────────────────────────────

interface EditBlockDrawerProps {
  block:          AdaptiveBlockData;
  tenantId:       string;
  revalidatePath?: string;
  onClose:        () => void;
  onSaved:        () => void;
  /** Tenant's named block-token sets (design.blockTokenSets) for the picker. */
  blockTokenSets?: readonly BlockTokenSet[];
}

export function EditBlockDrawer({
  block,
  tenantId,
  revalidatePath,
  onClose,
  onSaved,
  blockTokenSets = [],
}: EditBlockDrawerProps) {
  const slotId        = slotFromKey(block.key);
  const layoutOptions = LAYOUT_OPTIONS[slotId] ?? [];

  // Token groups relevant to THIS block: all universal groups + only the
  // block-specific group for the current slot (hide the others).
  const visibleTokenGroups = BLOCK_TOKEN_GROUPS.filter(
    (g) => !BLOCK_SPECIFIC_GROUP_TITLES.has(g.title) || g.title === SLOT_TOKEN_GROUP[slotId],
  );

  // ── Form state: content ────────────────────────────────────────────────────

  const [isActive, setIsActive]    = useState(block.isActive);
  const [title, setTitle]          = useState(block.defaultVariant.title ?? "");
  const [subtitle, setSubtitle]    = useState(block.defaultVariant.subtitle ?? "");
  const [tag, setTag]              = useState(block.defaultVariant.tag ?? "");
  const [layoutVariant, setLayout] = useState(block.defaultVariant.layoutVariant ?? "");
  const [contentAlign, setAlign]   = useState<"left" | "center" | "right">(
    block.defaultVariant.contentAlign ?? "left",
  );

  // ── Form state: media (initialise from existing media) ─────────────────────

  const existingMedia = block.defaultVariant.media;
  const existingVid   = existingMedia?.kind === "video" ? existingMedia.video : null;

  const [mediaType, setMediaType] = useState<"none" | "image" | "video">(
    existingMedia?.kind ?? "none",
  );

  // Image
  const [imageUrl, setImageUrl] = useState(
    existingMedia?.kind === "image" ? existingMedia.url : "",
  );
  const [imageAlt, setImageAlt] = useState(
    existingMedia?.kind === "image" ? existingMedia.alt : "",
  );
  const [imageObjectPosition, setImageObjectPosition] = useState(
    (existingMedia?.kind === "image" ? existingMedia.objectPosition : undefined) ?? "center",
  );

  // Video — source
  const [videoSource, setVideoSource] = useState<VideoSource>(
    existingVid?.source ?? "upload",
  );
  // Video — upload-specific
  const [videoUrl, setVideoUrl]         = useState(
    existingVid?.source === "upload" ? existingVid.url : "",
  );
  const [videoPoster, setVideoPoster]   = useState(
    existingVid?.source === "upload" ? (existingVid.poster ?? "") : "",
  );
  const [videoMuted, setVideoMuted]     = useState(
    existingVid?.source === "upload" ? (existingVid.muted ?? true) : true,
  );
  const [videoControls, setVideoControls] = useState(
    existingVid?.source === "upload" ? (existingVid.controls ?? true) : true,
  );
  // Video — YouTube / Vimeo id
  const [videoId, setVideoId] = useState(
    existingVid?.source === "youtube" || existingVid?.source === "vimeo"
      ? existingVid.videoId
      : "",
  );
  // Video — common
  const [videoAutoplay, setVideoAutoplay] = useState(existingVid?.autoplay ?? false);
  const [videoLoop, setVideoLoop]         = useState(existingVid?.loop ?? false);

  // ── CTAs ───────────────────────────────────────────────────────────────────

  const [ctas, setCtas] = useState<CTA[]>(
    (block.defaultVariant.ctas ?? []).map((c) => ({
      label:   c.label   ?? "",
      href:    c.href    ?? "",
      variant: (c.variant as CTA["variant"]) ?? "primary",
    })),
  );

  // ── Items (proof / feature) ────────────────────────────────────────────────

  const [items, setItems] = useState<AdaptiveVariantItem[]>(
    block.defaultVariant.items ?? [],
  );

  // ── Slides (hero_carousel) ─────────────────────────────────────────────────
  // Each slide is an independent hero (heading/subheading/media/CTA). Only
  // surfaced + persisted when the hero layout is "hero_carousel".

  const [slides, setSlides] = useState<HeroSlideData[]>(
    block.defaultVariant.slides ?? [],
  );
  // Carousel auto-advance toggle (default on). Visitor steps through manually
  // when off. Only persisted for the hero_carousel layout.
  const [carouselAutoplay, setCarouselAutoplay] = useState(
    block.defaultVariant.carouselAutoplay ?? true,
  );

  // ── AI / Decision metadata ────────────────────────────────────────────────
  // Structured signals the AI uses to decide whether to show this variant.
  // Stored as a Partial — incomplete metadata is allowed (the variant is then
  // a manual/rule-based fallback; aiReady is derived from completeness).
  const [decisionMeta, setDecisionMeta] = useState<Partial<VariantDecisionMeta>>(
    block.defaultVariant.decisionMeta ?? {},
  );
  function setDM(patch: Partial<VariantDecisionMeta>) {
    setDecisionMeta((m) => ({ ...m, ...patch }));
  }

  // ── Block-level design tokens ──────────────────────────────────────────────
  // A named token set (from design.blockTokenSets) applied when this block
  // renders, plus optional inline tweaks that layer on top.
  const [tokenSet, setTokenSet] = useState(block.defaultVariant.tokenSet ?? "");
  const [tokens, setTokens]     = useState<CuratedBlockTokens>(
    block.defaultVariant.tokens ?? {},
  );

  // ── Notification settings (notification slot only) ──
  const [notifPosition, setNotifPosition]     = useState<NotificationPosition>(block.defaultVariant.notifPosition ?? "top");
  const [notifDismissible, setNotifDismissible] = useState<boolean>(block.defaultVariant.notifDismissible ?? true);
  const [notifAutoDismissMs, setNotifAutoDismissMs] = useState<string>(
    block.defaultVariant.notifAutoDismissMs !== undefined ? String(block.defaultVariant.notifAutoDismissMs) : "",
  );
  const [notifFrequency, setNotifFrequency] = useState<NotificationFrequency>(block.defaultVariant.notifFrequency ?? "always");
  const [notifTtl, setNotifTtl]             = useState<string>(block.defaultVariant.notifTtl !== undefined ? String(block.defaultVariant.notifTtl) : "");
  const [notifTtlUnit, setNotifTtlUnit]     = useState<NotificationTtlUnit>(block.defaultVariant.notifTtlUnit ?? "days");
  const [notifCampaign, setNotifCampaign]   = useState<string>(block.defaultVariant.notifCampaignId ?? "");
  // Opt-in per-block design override. Default ON only when the block already
  // carries a token set or inline tokens; otherwise the block inherits the site
  // theme and the override editor stays hidden.
  const [overrideDesign, setOverrideDesign] = useState<boolean>(
    !!(block.defaultVariant.tokenSet ||
      (block.defaultVariant.tokens && Object.keys(block.defaultVariant.tokens).length > 0)),
  );
  function setToken(field: keyof CuratedBlockTokens, value: string) {
    setTokens((prev) => {
      const next = { ...prev };
      if (value.trim()) (next as Record<string, string>)[field] = value;
      else delete (next as Record<string, string>)[field];
      return next;
    });
  }
  // The named set currently referenced — used to PREVIEW its values in the
  // fields (as placeholders + tinted swatches) so the admin visibly reflects
  // the set. Inline `tokens` still override per field; empty fields inherit.
  const selectedSet = tokenSet ? blockTokenSets.find((s) => s.key === tokenSet) : undefined;
  // Only offer sets scoped to this block type (or unscoped = all). Keep the
  // currently-selected set in the list even if it was later re-scoped elsewhere.
  const availableSets = blockTokenSets.filter(
    (s) => !s.slots?.length || s.slots.includes(slotId) || s.key === tokenSet,
  );
  const isHex = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
  function toggleArrayValue<T>(arr: readonly T[] | undefined, val: T): T[] {
    const set = new Set(arr ?? []);
    if (set.has(val)) set.delete(val); else set.add(val);
    return [...set];
  }
  function csvToArray(s: string): string[] {
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }

  // ── Async ──────────────────────────────────────────────────────────────────

  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTrans] = useTransition();

  // ── Live preview ────────────────────────────────────────────────────────────
  // Debounced URL to the isolated preview route, which renders THIS block with
  // the real production components (layout variant, media, carousel) + tenant
  // theme. Encodes the current (unsaved) draft as base64url in the query.
  const [previewSrc, setPreviewSrc]       = useState("");
  const [isPreviewStale, setPreviewStale] = useState(false);

  // ── Device-frame preview scaling ───────────────────────────────────────────
  // The preview renders the real block in an iframe. Hero backgrounds size
  // themselves with viewport-relative height (clamp(420px, 70vh, 820px)), so a
  // short iframe crops object-cover differently than a full-height live viewport
  // — the classic preview/live mismatch. Fix: render the iframe at a real
  // desktop viewport (PREVIEW_VIEWPORT) and scale it down to fit the column, so
  // `70vh` and the clamp resolve exactly as on that desktop → identical crop.
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewScale(el.clientWidth / PREVIEW_VIEWPORT.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewSrc]);

  useEffect(() => {
    setPreviewStale(true);
    const id = setTimeout(() => {
      try {
        setPreviewSrc(buildBlockPreviewSrc(tenantId, block.key, buildVariant()));
      } catch { /* keep the previous preview on encode failure */ }
      setPreviewStale(false);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title, subtitle, tag, layoutVariant, contentAlign,
    mediaType, imageUrl, imageAlt, imageObjectPosition, videoSource, videoUrl, videoPoster,
    videoMuted, videoControls, videoId, videoAutoplay, videoLoop,
    ctas, items, slides, carouselAutoplay, tokenSet, tokens,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCtaChange(idx: number, field: keyof CTA, value: string) {
    setCtas((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }
  function handleCtaRemove(idx: number) {
    setCtas((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleItemChange(idx: number, field: keyof AdaptiveVariantItem, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function handleItemRemove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function handleItemMediaChange(idx: number, media: HeroBannerMedia | undefined) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, media } : it)));
  }
  function handleItemMediaSideChange(idx: number, side: "left" | "right" | undefined) {
    // Default (undefined) writes no value, so the item keeps inheriting the tenant token.
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it };
      if (side) next.mediaSide = side;
      else delete next.mediaSide;
      return next;
    }));
  }

  function handleSlideChange(idx: number, field: keyof HeroSlideData, value: string) {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }
  function handleSlideRemove(idx: number) {
    setSlides((prev) => prev.filter((_, i) => i !== idx));
  }
  function handleSlideAdd() {
    setSlides((prev) => [...prev, {}]);
  }
  function handleSlideMediaChange(idx: number, slideMedia: HeroBannerMedia | undefined) {
    // Setting structured media supersedes the legacy flat mediaUrl/mediaAlt.
    setSlides((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, media: slideMedia, mediaUrl: undefined, mediaAlt: undefined } : s,
      ),
    );
  }

  function buildMedia(): HeroBannerMedia | undefined {
    if (mediaType === "image" && imageUrl) {
      return {
        kind: "image",
        url: imageUrl,
        alt: imageAlt,
        // Omit the default ("center") so existing content stays byte-identical.
        ...(imageObjectPosition && imageObjectPosition !== "center"
          ? { objectPosition: imageObjectPosition }
          : {}),
      } satisfies HeroBannerImage;
    }
    if (mediaType === "video") {
      if (videoSource === "upload" && videoUrl) {
        const vid: HeroBannerVideoUpload = {
          source:   "upload",
          url:      videoUrl,
          ...(videoPoster  ? { poster:   videoPoster }  : {}),
          // Always persist the booleans (including false) — a conditional spread
          // dropped `false`, so an OFF toggle reverted to its `?? true` default on
          // reload (e.g. Controls kept turning itself back on).
          autoplay: videoAutoplay,
          loop:     videoLoop,
          muted:    videoMuted,
          controls: videoControls,
        };
        return { kind: "video", video: vid } satisfies HeroBannerVideo;
      }
      if (videoSource === "youtube" && videoId) {
        const vid: HeroBannerVideoYouTube = {
          source:   "youtube",
          videoId,
          ...(videoAutoplay ? { autoplay: true } : {}),
          ...(videoLoop     ? { loop:     true } : {}),
        };
        return { kind: "video", video: vid } satisfies HeroBannerVideo;
      }
      if (videoSource === "vimeo" && videoId) {
        const vid: HeroBannerVideoVimeo = {
          source:   "vimeo",
          videoId,
          ...(videoAutoplay ? { autoplay: true } : {}),
          ...(videoLoop     ? { loop:     true } : {}),
        };
        return { kind: "video", video: vid } satisfies HeroBannerVideo;
      }
    }
    return undefined;
  }

  // Assemble the AdaptiveVariantContent from current form state. Shared by the
  // save path AND the live preview, so what you preview is exactly what saves.
  function buildVariant(): AdaptiveVariantContent {
    const media = buildMedia();
    // Save-time normalisation of the inline rich-copy fields (defense in depth;
    // rendering re-validates too): canonicalise and strip invalid-scheme links.
    const normalizedItems = items.map((it) => ({
      ...it,
      ...(it.text !== undefined ? { text: normalizeInlineMarkup(it.text) } : {}),
      ...(it.body !== undefined ? { body: normalizeInlineMarkup(it.body) } : {}),
    }));
    return {
      title,
      subtitle: normalizeInlineMarkup(subtitle),
      ...(tag           ? { tag }                               : {}),
      ...(layoutVariant ? { layoutVariant }                     : {}),
      ...(contentAlign !== "left" ? { contentAlign }            : {}),
      ...(ctas.length   ? { ctas: ctas.map((c) => ({ label: c.label, href: c.href, variant: c.variant })) } : {}),
      ...(media         ? { media }                             : {}),
      ...(items.length  ? { items: normalizedItems }            : {}),
      // Persist slides only for the carousel layout — keeps other layouts'
      // payloads clean and avoids stale slide data lingering after a layout
      // switch away from the carousel.
      ...(layoutVariant === "hero_carousel" && slides.length ? { slides } : {}),
      ...(layoutVariant === "hero_carousel" ? { carouselAutoplay } : {}),
      ...(Object.keys(decisionMeta).length ? { decisionMeta } : {}),
      ...(tokenSet ? { tokenSet } : {}),
      ...(Object.keys(tokens).length ? { tokens } : {}),
      // Notification settings — persisted only for the notification slot.
      ...(slotId === "notification" ? {
        notifPosition,
        notifDismissible,
        ...(notifAutoDismissMs.trim() !== "" ? { notifAutoDismissMs: Number(notifAutoDismissMs) } : {}),
        notifFrequency,
        ...(notifFrequency === "once_per_period" && notifTtl.trim() !== "" ? { notifTtl: Number(notifTtl), notifTtlUnit } : {}),
        ...(notifCampaign.trim() !== "" ? { notifCampaignId: notifCampaign.trim() } : {}),
      } : {}),
    };
  }

  function handleSave() {
    setError(null);
    startTrans(async () => {
      const variant = buildVariant();

      const savePath =
        revalidatePath ??
        (block.tenantId
          ? `/admin/tenants/${block.tenantId}/personalization/blocks`
          : "/admin/platform/blocks");

      const res = await upsertAdaptiveBlockAction(
        {
          id:               block.id,
          key:              block.key,
          tenantId:         block.tenantId ?? null,
          isActive,
          defaultVariant:   variant,
          adaptiveVariants: block.adaptiveVariants,
        },
        savePath,
      );

      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col bg-white shadow-2xl border-l border-neutral-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 shrink-0">
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">
              {block.tenantId ? `Tenant block · ${block.tenantId}` : "Platform block"}
            </p>
            <code className="text-sm font-mono font-semibold text-neutral-900">{block.key}</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body: editable form (left) + live preview (right) */}
        <div className="flex-1 flex min-h-0">

          {/* Left column: the form */}
          <div className="w-full md:w-[52%] md:max-w-xl overflow-y-auto px-5 py-5 space-y-6 border-r border-neutral-200">

          {/* ── Active toggle ────────────────────────────────────────────── */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsActive((v) => !v)}
              className={[
                "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors",
                isActive ? "border-brand-500 bg-brand-500" : "border-neutral-300 bg-neutral-200",
              ].join(" ")}
            >
              <span className={[
                "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                isActive ? "translate-x-3.5" : "translate-x-0.5",
              ].join(" ")} />
            </div>
            <span className="text-sm font-medium text-neutral-800">
              {isActive ? "Active" : "Inactive"}
            </span>
            <span className="text-xs text-neutral-400">
              {isActive ? "Shown to visitors when matched" : "Never rendered"}
            </span>
          </label>

          {/* ── Content ─────────────────────────────────────────────────── */}
          <fieldset className="space-y-3">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Content</legend>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Your primary headline here"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                {slotId === "cta" ? "Text" : "Subtitle"}
              </label>
              {slotId === "hero" || slotId === "cta" ? (
                <RichCopyEditor
                  value={subtitle}
                  onChange={setSubtitle}
                  ariaLabel={slotId === "cta" ? "CTA text" : "Hero subtitle"}
                  placeholder="Supporting copy. Select text to make it bold, italic, or a link."
                />
              ) : (
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  rows={3}
                  placeholder="Supporting paragraph beneath the headline."
                  className={`${INPUT_CLS} resize-none`}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Eyebrow tag <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="New feature · Trusted by 500+ teams"
                className={INPUT_CLS}
              />
            </div>
          </fieldset>

          {/* ── Layout ──────────────────────────────────────────────────── */}
          <fieldset className="space-y-3">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Layout</legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Layout variant</label>
                {layoutOptions.length > 0 ? (
                  <select
                    value={layoutVariant}
                    onChange={(e) => setLayout(e.target.value)}
                    className={INPUT_CLS}
                  >
                    <option value="">— default —</option>
                    {layoutOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={layoutVariant}
                    onChange={(e) => setLayout(e.target.value)}
                    placeholder="layout_key"
                    className={INPUT_CLS}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Content alignment</label>
                <select
                  value={contentAlign}
                  onChange={(e) => setAlign(e.target.value as "left" | "center" | "right")}
                  className={INPUT_CLS}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* ── Slides (carousel) ───────────────────────────────────────── */}
          {layoutVariant === "hero_carousel" && (
            <fieldset className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <div className="flex items-center justify-between">
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                  Carousel slides
                </legend>
                <button
                  type="button"
                  onClick={handleSlideAdd}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  + Add slide
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Each slide is shown in turn (arrows + dots). The main
                Title/Subtitle/Media fields above are used as a fallback when no
                slides are added.
              </p>
              <div className="rounded-lg border border-neutral-100 bg-white px-4 py-2.5">
                <Toggle
                  label="Autoplay slides"
                  hint="off = visitor steps through manually"
                  value={carouselAutoplay}
                  onChange={setCarouselAutoplay}
                />
              </div>
              {slides.length === 0 && (
                <p className="text-xs text-neutral-400 italic">No slides yet — add at least two.</p>
              )}
              {slides.map((slide, idx) => (
                <div key={idx} className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500">Slide {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleSlideRemove(idx)}
                      className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Heading</label>
                      <input
                        type="text"
                        value={slide.heading ?? ""}
                        onChange={(e) => handleSlideChange(idx, "heading", e.target.value)}
                        placeholder="Slide headline"
                        className={SMALL_INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Subheading</label>
                      <input
                        type="text"
                        value={slide.subheading ?? ""}
                        onChange={(e) => handleSlideChange(idx, "subheading", e.target.value)}
                        placeholder="Supporting line"
                        className={SMALL_INPUT_CLS}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-500 mb-1">Media (image or video)</label>
                    <SlideMediaEditor
                      tenantId={tenantId}
                      media={slide.media}
                      onChange={(m) => handleSlideMediaChange(idx, m)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">CTA label</label>
                      <input
                        type="text"
                        value={slide.ctaLabel ?? ""}
                        onChange={(e) => handleSlideChange(idx, "ctaLabel", e.target.value)}
                        placeholder="Learn more"
                        className={SMALL_INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">CTA URL</label>
                      <input
                        type="text"
                        value={slide.ctaUrl ?? ""}
                        onChange={(e) => handleSlideChange(idx, "ctaUrl", e.target.value)}
                        placeholder="/contact"
                        className={SMALL_INPUT_CLS}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          {/* ── Media ───────────────────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Media</legend>

            {/* Type selector */}
            <div className="flex gap-2">
              {(["none", "image", "video"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
                  className={TOGGLE_BTN(mediaType === t)}
                >
                  {t === "none" ? "None" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Image fields */}
            {mediaType === "image" && (
              <ImagePicker
                tenantId={tenantId}
                url={imageUrl}
                alt={imageAlt}
                objectPosition={imageObjectPosition}
                onUrlChange={setImageUrl}
                onAltChange={setImageAlt}
                onObjectPositionChange={setImageObjectPosition}
              />
            )}

            {/* Video fields */}
            {mediaType === "video" && (
              <div className="space-y-4">
                {/* Source tabs */}
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
                  autoplay={videoAutoplay}
                  loop={videoLoop}
                  muted={videoMuted}
                  controls={videoControls}
                  onVideoUrl={setVideoUrl}
                  onVideoPoster={setVideoPoster}
                  onVideoId={setVideoId}
                  onAutoplay={setVideoAutoplay}
                  onLoop={setVideoLoop}
                  onMuted={setVideoMuted}
                  onControls={setVideoControls}
                />
              </div>
            )}
          </fieldset>

          {/* ── CTAs ────────────────────────────────────────────────────── */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">CTAs</legend>
              {ctas.length < 2 && (
                <button
                  type="button"
                  onClick={() => setCtas((prev) => [...prev, { label: "", href: "", variant: "primary" }])}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  + Add CTA
                </button>
              )}
            </div>
            {ctas.length === 0 && (
              <p className="text-xs text-neutral-400 italic">No CTAs — add up to 2.</p>
            )}
            {ctas.map((cta, idx) => (
              <CtaRow
                key={idx}
                cta={cta}
                idx={idx}
                onChange={handleCtaChange}
                onRemove={handleCtaRemove}
              />
            ))}
          </fieldset>

          {/* ── Items (proof / feature) ──────────────────────────────────── */}
          {hasItems(slotId) && (
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Items ({slotId === "proof" ? "stats / quotes" : "feature cards"})
                </legend>
                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, emptyItem()])}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  + Add item
                </button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-neutral-400 italic">No items yet.</p>
              )}
              {items.map((item, idx) => (
                <ItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  tenantId={tenantId}
                  slotId={slotId}
                  onChange={handleItemChange}
                  onMediaChange={handleItemMediaChange}
                  onMediaSideChange={handleItemMediaSideChange}
                  onRemove={handleItemRemove}
                />
              ))}
            </fieldset>
          )}

          {/* ── Notification settings (notification slot only) ──────────────── */}
          {slotId === "notification" && (
            <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Notification
              </legend>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Position</label>
                  <select value={notifPosition} onChange={(e) => setNotifPosition(e.target.value as NotificationPosition)} className={SMALL_INPUT_CLS}>
                    <option value="top">Top banner</option>
                    <option value="bottom">Bottom banner</option>
                    <option value="left">Left toast</option>
                    <option value="right">Right toast</option>
                    <option value="center">Center modal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Frequency</label>
                  <select value={notifFrequency} onChange={(e) => setNotifFrequency(e.target.value as NotificationFrequency)} className={SMALL_INPUT_CLS}>
                    <option value="always">Always</option>
                    <option value="once_per_session">Once per session</option>
                    <option value="once_per_period">Once per period</option>
                  </select>
                </div>
              </div>

              {notifFrequency === "once_per_period" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Period</label>
                    <input type="number" min="1" value={notifTtl} onChange={(e) => setNotifTtl(e.target.value)} placeholder="7" className={SMALL_INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Unit</label>
                    <select value={notifTtlUnit} onChange={(e) => setNotifTtlUnit(e.target.value as NotificationTtlUnit)} className={SMALL_INPUT_CLS}>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Auto-dismiss (ms)</label>
                  <input
                    type="number" min="0" value={notifAutoDismissMs}
                    onChange={(e) => setNotifAutoDismissMs(e.target.value)}
                    placeholder={notifPosition === "center" ? "n/a for modal" : "0 = never"}
                    disabled={notifPosition === "center"}
                    className={SMALL_INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 mb-0.5">Campaign id (optional)</label>
                  <input type="text" value={notifCampaign} onChange={(e) => setNotifCampaign(e.target.value)} placeholder="spring-2026" className={SMALL_INPUT_CLS} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-neutral-600">
                <input type="checkbox" checked={notifDismissible} onChange={(e) => setNotifDismissible(e.target.checked)} />
                Dismissible (the center modal is always closable)
              </label>
              <p className="text-[10px] text-neutral-400">
                Auto-dismiss applies to banners and toasts only. Bump the campaign id to reset the frequency cap after a message change.
              </p>
            </fieldset>
          )}

          {/* ── AI / Decision metadata ──────────────────────────────────────── */}
          <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              AI / Decision
            </legend>
            <p className="text-xs text-neutral-500">
              Structured signals the AI uses to decide whether to show this variant. Complete all
              fields to make it AI-selectable; an incomplete block still works as a manual/rule-based
              fallback.
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Decision label</label>
              <input
                type="text"
                value={decisionMeta.decisionLabel ?? ""}
                onChange={(e) => setDM({ decisionLabel: e.target.value })}
                placeholder="Google — Problem Aware"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Decision summary</label>
              <textarea
                value={decisionMeta.decisionSummary ?? ""}
                onChange={(e) => setDM({ decisionSummary: e.target.value })}
                rows={2}
                placeholder="One sentence: what this variant communicates and why a visitor should see it."
                className={`${INPUT_CLS} resize-none`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Intended audience</label>
              <input
                type="text"
                value={decisionMeta.intendedAudience ?? ""}
                onChange={(e) => setDM({ intendedAudience: e.target.value })}
                placeholder="First-time visitors from Google with no role context"
                className={INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Intent level</label>
                <select
                  value={decisionMeta.intentLevel ?? ""}
                  onChange={(e) => setDM({ intentLevel: (e.target.value || undefined) as IntentLevel | undefined })}
                  className={INPUT_CLS}
                >
                  <option value="">—</option>
                  {INTENT_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tone</label>
                <select
                  value={decisionMeta.tone ?? ""}
                  onChange={(e) => setDM({ tone: (e.target.value || undefined) as VariantTone | undefined })}
                  className={INPUT_CLS}
                >
                  <option value="">—</option>
                  {VARIANT_TONES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Funnel stages</label>
              <div className="flex flex-wrap gap-2">
                {FUNNEL_STAGES.map((s) => {
                  const on = decisionMeta.funnelStages?.includes(s) ?? false;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDM({ funnelStages: toggleArrayValue(decisionMeta.funnelStages, s) })}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Best for sources</label>
              <div className="flex flex-wrap gap-2">
                {VISITOR_SOURCES.map((s) => {
                  const on = decisionMeta.bestForSources?.includes(s) ?? false;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDM({ bestForSources: toggleArrayValue(decisionMeta.bestForSources, s) })}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Primary goal</label>
              <input
                type="text"
                value={decisionMeta.primaryGoal ?? ""}
                onChange={(e) => setDM({ primaryGoal: e.target.value })}
                placeholder="Book a demo"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Supporting goals <span className="font-normal text-neutral-400">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={(decisionMeta.supportingGoals ?? []).join(", ")}
                onChange={(e) => setDM({ supportingGoals: csvToArray(e.target.value) })}
                placeholder="Newsletter signup, Watch demo video"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Exclusions <span className="font-normal text-neutral-400">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={(decisionMeta.exclusions ?? []).join(", ")}
                onChange={(e) => setDM({ exclusions: csvToArray(e.target.value) })}
                placeholder="Returning customers, Logged-in users"
                className={INPUT_CLS}
              />
            </div>
          </fieldset>

          {/* ── Block-level design tokens ─────────────────────────────────── */}
          <fieldset className="space-y-3">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Design
            </legend>
            <Toggle
              label="Custom design for this block"
              hint={overrideDesign ? "Overriding the site theme" : "Off = inherit the site theme (recommended)"}
              value={overrideDesign}
              onChange={(v) => {
                setOverrideDesign(v);
                if (!v) { setTokenSet(""); setTokens({}); }
              }}
            />
            {!overrideDesign && (
              <p className="text-xs text-neutral-500">
                This block uses the site theme. Turn on to restyle just this block — pick a reusable
                token set (Design → Blocks) or set individual tokens; anything left empty still
                inherits the theme.
              </p>
            )}

            {overrideDesign && (
            <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Token set</label>
              <select
                value={tokenSet}
                onChange={(e) => setTokenSet(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">— none (site theme) —</option>
                {availableSets.map((s) => (
                  <option key={s.id} value={s.key}>{s.name} ({s.key})</option>
                ))}
              </select>
              {availableSets.length === 0 && (
                <p className="text-[11px] text-neutral-400 mt-1">
                  No token sets for this block type yet — create one in Design → Blocks (set its
                  scope to “{slotId}” or leave it unscoped), or use the inline overrides below.
                </p>
              )}
            </div>

            {visibleTokenGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group.title}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.fields.map((f) => {
                    const raw = (tokens as Record<string, string>)[f.key] ?? "";
                    // Value inherited from the selected named set (preview only).
                    const setVal = (selectedSet?.tokens as Record<string, string> | undefined)?.[f.key] ?? "";
                    const inherited = !raw && Boolean(setVal);
                    return (
                      <label key={f.key} className="block">
                        <span className="block text-[11px] font-medium text-neutral-600 mb-0.5">
                          {f.label}
                          {inherited && <span className="ml-1 text-[10px] font-normal text-indigo-400">· from set</span>}
                        </span>
                        {f.kind === "surface" ? (
                          <select value={raw} onChange={(e) => setToken(f.key, e.target.value)} className={INPUT_CLS}>
                            {["", ...VALID_SURFACE_ROLES].map((o) => (
                              <option key={o} value={o}>
                                {o === "" ? (setVal ? `— set: ${setVal} —` : "— none —") : o}
                              </option>
                            ))}
                          </select>
                        ) : f.kind === "color" ? (
                          <span className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={isHex(raw) ? raw : isHex(setVal) ? setVal : "#ffffff"}
                              onChange={(e) => setToken(f.key, e.target.value)}
                              className="h-8 w-8 shrink-0 rounded border border-neutral-300 cursor-pointer p-0"
                              title={inherited ? `Inherited from set: ${setVal}` : undefined}
                            />
                            <input
                              value={raw}
                              onChange={(e) => setToken(f.key, e.target.value)}
                              placeholder={setVal || "#111827"}
                              className={INPUT_CLS + " font-mono" + (inherited ? " placeholder:text-indigo-400" : "")}
                            />
                          </span>
                        ) : (
                          <input
                            value={raw}
                            onChange={(e) => setToken(f.key, e.target.value)}
                            placeholder={setVal || f.placeholder || ""}
                            className={INPUT_CLS + (inherited ? " placeholder:text-indigo-400" : "")}
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
          </fieldset>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          </div>

          {/* Right column: live preview (full-fidelity, real block components) */}
          <div className="hidden md:flex flex-1 flex-col bg-neutral-100 min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
              <span className="text-xs font-semibold text-neutral-700">Live preview</span>
              <span className="text-[10px] text-neutral-400">
                {isPreviewStale ? "updating…" : "default variant · tenant theme"}
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-neutral-200 p-4">
              {previewSrc ? (
                // Device frame: a 16:9 box scaled to the column width. The iframe
                // renders at the real desktop viewport, then scales down — so the
                // hero's crop matches what a visitor sees on that desktop.
                <div
                  ref={previewBoxRef}
                  className="relative mx-auto w-full max-w-[1280px] overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm"
                  style={{ aspectRatio: `${PREVIEW_VIEWPORT.width} / ${PREVIEW_VIEWPORT.height}` }}
                >
                  <iframe
                    src={previewSrc}
                    title="Block preview"
                    className="absolute left-0 top-0 origin-top-left border-0 bg-white"
                    style={{
                      width:  PREVIEW_VIEWPORT.width,
                      height: PREVIEW_VIEWPORT.height,
                      transform: `scale(${previewScale})`,
                    }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                  Loading preview…
                </div>
              )}
            </div>
            <p className="px-4 py-2 text-[10px] leading-snug text-neutral-400 border-t border-neutral-200 bg-white shrink-0">
              Shows the default variant with this tenant&apos;s theme and any per-block design override.
              Interactive parts (carousel auto-advance, video playback) display their first frame.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={[
              "rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
              isPending
                ? "cursor-not-allowed bg-brand-300"
                : "bg-brand-500 hover:bg-brand-600 active:bg-brand-700",
            ].join(" ")}
          >
            {isPending ? "Saving…" : "Save block"}
          </button>
        </div>

      </aside>
    </>
  );
}
