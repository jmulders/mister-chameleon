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
    return { kind: "image", source: "asset", url: m.url, alt: m.alt, fit: "cover" };
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
