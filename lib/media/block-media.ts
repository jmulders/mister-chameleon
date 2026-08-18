/**
 * BlockMedia — a small, reusable media model shared by the spotlight block
 * variants (proof_spotlight, feature_spotlight) and rendered by BlockMediaView.
 *
 * One model covers three sources:
 *   - asset       : an uploaded image or video (url points at the asset)
 *   - youtube     : a YouTube video (id only; embedded privacy-first via nocookie)
 *   - vimeo       : a Vimeo video   (id only; embedded with dnt=1)
 *
 * `fit` controls object-fit: "cover" for a face/photo that should fill the frame,
 * "contain" for a logo that must not be cropped (rendered on a neutral surface).
 *
 * This module is pure data + URL helpers with no React or app imports, so both
 * cms/types (proof) and page-config (feature) can reference BlockMedia without a
 * cycle. Privacy note: embeds use youtube-nocookie.com and Vimeo dnt=1 by design;
 * the renderer shows a poster facade and only loads the iframe on interaction (or
 * on autoplay), so no third-party player script loads until the visitor opts in.
 */

export interface BlockMedia {
  /** Whether this is a still image or a moving video. */
  kind: "image" | "video";
  /**
   * Where the media comes from. Defaults to "asset". "youtube"/"vimeo" use `id`;
   * "asset" uses `url`.
   */
  source?: "asset" | "youtube" | "vimeo";
  /** Asset delivery URL (image src or uploaded-video src). Used when source = "asset". */
  url?: string;
  /** YouTube / Vimeo video id. Used when source = "youtube" | "vimeo". */
  id?: string;
  /** Poster image shown before a video plays (and behind the embed facade). */
  poster?: string;
  /** When true, the active video autoplays muted; otherwise it is click-to-play. */
  autoplay?: boolean;
  /** object-fit for images. "cover" (default) for photos, "contain" for logos. */
  fit?: "cover" | "contain";
  /** Alt text for images (accessibility). */
  alt?: string;
}

/** Platform-default poster for a YouTube video (its own thumbnail) when none is set. */
export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

/** True when the media has enough to render (an image/video with a real source). */
export function isRenderableMedia(media: BlockMedia | null | undefined): media is BlockMedia {
  if (!media) return false;
  const source = media.source ?? "asset";
  if (source === "asset") return typeof media.url === "string" && media.url.trim() !== "";
  return typeof media.id === "string" && media.id.trim() !== "";
}

/** Privacy-first YouTube embed URL (nocookie host). Autoplay implies muted. */
export function youtubeEmbedSrc(id: string, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (opts?.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

/** Privacy-first Vimeo embed URL (dnt=1). Autoplay implies muted. */
export function vimeoEmbedSrc(id: string, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams({ dnt: "1", playsinline: "1" });
  if (opts?.autoplay) {
    params.set("autoplay", "1");
    params.set("muted", "1");
  }
  return `https://player.vimeo.com/video/${encodeURIComponent(id)}?${params.toString()}`;
}

/** The `allow` attribute for a media iframe (autoplay is gated by the URL params). */
export const MEDIA_IFRAME_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
