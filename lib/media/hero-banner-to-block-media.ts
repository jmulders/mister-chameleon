/**
 * Map the admin/editor HeroBannerMedia shape (produced by SlideMediaEditor) onto
 * the shared BlockMedia model rendered by BlockMediaView. Kept in its own leaf
 * module so block-media.ts stays import-free (no cms/types cycle).
 */

import type { HeroBannerMedia } from "@/cms/types";
import type { BlockMedia } from "@/lib/media/block-media";

export function heroBannerMediaToBlockMedia(m: HeroBannerMedia | undefined | null): BlockMedia | undefined {
  if (!m) return undefined;

  if (m.kind === "image") {
    if (!m.url) return undefined;
    return {
      kind: "image",
      source: "asset",
      url: m.url,
      alt: m.alt,
      fit: m.fit ?? "cover",
      ...(m.objectPosition ? { objectPosition: m.objectPosition } : {}),
    };
  }

  const v = m.video;
  if (v.source === "upload") {
    if (!v.url) return undefined;
    return { kind: "video", source: "asset", url: v.url, poster: v.poster, autoplay: v.autoplay };
  }
  if (v.source === "youtube") {
    if (!v.videoId) return undefined;
    return { kind: "video", source: "youtube", id: v.videoId, autoplay: v.autoplay };
  }
  if (v.source === "vimeo") {
    if (!v.videoId) return undefined;
    return { kind: "video", source: "vimeo", id: v.videoId, autoplay: v.autoplay };
  }
  return undefined;
}

/**
 * Inverse of heroBannerMediaToBlockMedia: rebuild the editor's HeroBannerMedia
 * shape from a stored BlockMedia, so a saved contactPanel.media can seed
 * SlideMediaEditor. BlockMedia does not carry loop/muted/controls, so those fall
 * back to the editor's own defaults on load.
 */
export function blockMediaToHeroBannerMedia(m: BlockMedia | undefined | null): HeroBannerMedia | undefined {
  if (!m) return undefined;

  if (m.kind === "image") {
    if (!m.url) return undefined;
    return {
      kind: "image",
      url: m.url,
      alt: m.alt ?? "",
      // "cover" is the implicit default; only carry the non-default fit so a
      // legacy image round-trips to its minimal shape.
      ...(m.fit === "contain" ? { fit: "contain" as const } : {}),
      ...(m.objectPosition ? { objectPosition: m.objectPosition } : {}),
    };
  }

  const source = m.source ?? "asset";
  if (source === "asset") {
    if (!m.url) return undefined;
    return { kind: "video", video: { source: "upload", url: m.url, ...(m.poster ? { poster: m.poster } : {}), autoplay: !!m.autoplay } };
  }
  if (source === "youtube") {
    if (!m.id) return undefined;
    return { kind: "video", video: { source: "youtube", videoId: m.id, ...(m.autoplay ? { autoplay: true } : {}) } };
  }
  if (source === "vimeo") {
    if (!m.id) return undefined;
    return { kind: "video", video: { source: "vimeo", videoId: m.id, ...(m.autoplay ? { autoplay: true } : {}) } };
  }
  return undefined;
}
