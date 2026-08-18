/**
 * SliderSlide
 *
 * Renders a single slide inside the listing_slider carousel. Media rendering now
 * leans on the shared media core (BlockMediaView): image, uploaded video, and
 * privacy-facade YouTube/Vimeo embeds. The slide maps its SliderMediaItem to a
 * BlockMedia and delegates.
 *
 * `isActive` is optional and defaults to true, which preserves the existing
 * listing behaviour (every slide behaves as before). MediaSlider only overrides
 * it when a caller opts into pause-inactive, so the listing sliders are unchanged.
 *
 * All embeds use aspect-video (16:9) so every slide has a uniform height.
 */

import type { SliderMediaItem } from "@/page-config";
import type { BlockMedia } from "@/lib/media/block-media";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";

interface SliderSlideProps {
  slide:     SliderMediaItem;
  /** Whether this slide is the active/visible one. Defaults to true. */
  isActive?: boolean;
}

/** Map the listing SliderMediaItem shape onto the shared BlockMedia model. */
function toBlockMedia(slide: SliderMediaItem): BlockMedia | null {
  if (slide.mediaType === "image") {
    if (!slide.imageUrl) return null;
    return { kind: "image", source: "asset", url: slide.imageUrl, alt: slide.alt, fit: "cover" };
  }
  if (slide.videoSource === "youtube" && slide.videoId) {
    return { kind: "video", source: "youtube", id: slide.videoId, poster: slide.posterUrl, autoplay: slide.autoplay };
  }
  if (slide.videoSource === "vimeo" && slide.vimeoId) {
    return { kind: "video", source: "vimeo", id: slide.vimeoId, poster: slide.posterUrl, autoplay: slide.autoplay };
  }
  if (slide.videoSource === "upload" && slide.videoUrl) {
    return { kind: "video", source: "asset", url: slide.videoUrl, poster: slide.posterUrl, autoplay: slide.autoplay };
  }
  return null;
}

export function SliderSlide({ slide, isActive = true }: SliderSlideProps) {
  const media = toBlockMedia(slide);
  if (!media) return null; // missing required fields after the mapper

  return (
    <figure className="m-0">
      <BlockMediaView media={media} isActive={isActive} />
      {slide.caption && (
        <figcaption className="mt-2 text-sm leading-snug" style={{ color: "var(--text-muted)" }}>
          {slide.caption}
        </figcaption>
      )}
    </figure>
  );
}
