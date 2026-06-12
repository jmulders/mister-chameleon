/**
 * SliderSlide
 *
 * Renders a single slide inside the listing_slider carousel.
 *
 * ─── Supported media types ────────────────────────────────────────────────────
 *
 *   image         → <img> with optional alt text and caption
 *   video/youtube → YouTube Privacy-Enhanced (nocookie) iframe embed
 *   video/vimeo   → Vimeo iframe embed with DNT flag
 *   video/upload  → HTML5 <video> with controls, optional poster, autoplay
 *
 * All embeds use aspect-video (16:9) so every slide has a uniform height
 * regardless of the source dimensions.
 */

import type { SliderMediaItem } from "@/page-config";

interface SliderSlideProps {
  slide: SliderMediaItem;
}

export function SliderSlide({ slide }: SliderSlideProps) {
  const captionEl = slide.caption ? (
    <p
      className="mt-2 text-sm leading-snug"
      style={{ color: "var(--text-muted)" }}
    >
      {slide.caption}
    </p>
  ) : null;

  // ── Image ──────────────────────────────────────────────────────────────────

  if (slide.mediaType === "image") {
    if (!slide.imageUrl) return null;
    return (
      <figure className="m-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.imageUrl}
          alt={slide.alt ?? ""}
          className="w-full rounded-xl object-cover aspect-video"
          loading="lazy"
        />
        {captionEl && (
          <figcaption className="mt-2">{captionEl}</figcaption>
        )}
      </figure>
    );
  }

  // ── Video ──────────────────────────────────────────────────────────────────

  if (slide.videoSource === "youtube" && slide.videoId) {
    const autoParams = slide.autoplay ? "&autoplay=1&mute=1" : "";
    const ytSrc = `https://www.youtube-nocookie.com/embed/${slide.videoId}?rel=0&modestbranding=1${autoParams}`;
    return (
      <figure className="m-0">
        <div className="relative w-full overflow-hidden rounded-xl aspect-video">
          <iframe
            src={ytSrc}
            title={slide.caption ?? "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
          />
        </div>
        {captionEl && (
          <figcaption className="mt-2">{captionEl}</figcaption>
        )}
      </figure>
    );
  }

  if (slide.videoSource === "vimeo" && slide.vimeoId) {
    const autoParams = slide.autoplay ? "&autoplay=1&muted=1" : "";
    const vimeoSrc = `https://player.vimeo.com/video/${slide.vimeoId}?dnt=1${autoParams}`;
    return (
      <figure className="m-0">
        <div className="relative w-full overflow-hidden rounded-xl aspect-video">
          <iframe
            src={vimeoSrc}
            title={slide.caption ?? "Vimeo video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
          />
        </div>
        {captionEl && (
          <figcaption className="mt-2">{captionEl}</figcaption>
        )}
      </figure>
    );
  }

  if (slide.videoSource === "upload" && slide.videoUrl) {
    return (
      <figure className="m-0">
        {/* muted is required by browsers when autoplay is set */}
        <video
          src={slide.videoUrl}
          poster={slide.posterUrl ?? undefined}
          controls
          autoPlay={slide.autoplay ?? false}
          muted={slide.autoplay ?? false}
          loop={slide.autoplay ?? false}
          playsInline
          className="w-full rounded-xl aspect-video object-cover"
        />
        {captionEl && (
          <figcaption className="mt-2">{captionEl}</figcaption>
        )}
      </figure>
    );
  }

  // Slide has no renderable content (missing required fields after mapper)
  return null;
}
