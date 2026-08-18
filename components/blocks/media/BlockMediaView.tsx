"use client";

/**
 * BlockMediaView — the shared media renderer for spotlight blocks.
 *
 * Renders a BlockMedia (image, uploaded video, or a YouTube/Vimeo embed) inside a
 * 16:9 frame. Video rules:
 *   - Uploaded video: when autoplay AND this is the active slide it plays muted;
 *     otherwise it shows a poster with native controls (click to play). It is
 *     paused whenever it stops being the active slide.
 *   - YouTube/Vimeo: a privacy facade. The poster is shown with a play button and
 *     NO third-party script loads until the visitor clicks (or, when autoplay is
 *     set, until the slide becomes active). The iframe unmounts when the slide is
 *     no longer active, which pauses playback (never two videos at once).
 *
 * `isActive` defaults to true for the standalone (non-slider) case.
 */

import { useEffect, useRef, useState } from "react";
import type { BlockMedia } from "@/lib/media/block-media";
import { youtubeEmbedSrc, vimeoEmbedSrc, youtubeThumbUrl, MEDIA_IFRAME_ALLOW } from "@/lib/media/block-media";

export function BlockMediaView({
  media,
  isActive = true,
  className,
}: {
  media:     BlockMedia;
  isActive?: boolean;
  className?: string;
}) {
  const source = media.source ?? "asset";
  const objectFit = media.fit ?? "cover";

  const frameClass = `relative w-full overflow-hidden rounded-xl ${className ?? ""}`;
  const frameStyle = { aspectRatio: "16 / 9", background: "var(--block-media-bg, var(--section-subtle-bg, #f4f4f5))" } as const;

  // ── Image ────────────────────────────────────────────────────────────────────
  if (media.kind === "image") {
    return (
      <div className={frameClass} style={frameStyle}>
        {media.url && (
          // eslint-disable-next-line @next/next/no-img-element -- tenant asset on any host; next/image not guaranteed to allow it
          <img
            src={media.url}
            alt={media.alt ?? ""}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit }}
            loading="lazy"
          />
        )}
      </div>
    );
  }

  // ── Uploaded video (asset) ─────────────────────────────────────────────────────
  if (source === "asset") {
    return (
      <div className={frameClass} style={frameStyle}>
        <AssetVideo url={media.url} poster={media.poster} autoplay={!!media.autoplay} isActive={isActive} objectFit={objectFit} />
      </div>
    );
  }

  // ── YouTube / Vimeo facade ─────────────────────────────────────────────────────
  return (
    <div className={frameClass} style={frameStyle}>
      <EmbedFacade
        source={source}
        id={media.id ?? ""}
        poster={media.poster}
        autoplay={!!media.autoplay}
        isActive={isActive}
      />
    </div>
  );
}

// ── Uploaded video ────────────────────────────────────────────────────────────────

function AssetVideo({
  url, poster, autoplay, isActive, objectFit,
}: {
  url?: string; poster?: string; autoplay: boolean; isActive: boolean; objectFit: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);

  // Pause when this stops being the active slide; resume muted autoplay when active.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isActive && autoplay) {
      el.muted = true;
      void el.play().catch(() => { /* autoplay may be blocked; poster + controls remain */ });
    } else if (!isActive) {
      el.pause();
    }
  }, [isActive, autoplay]);

  if (!url) return null;
  return (
    <video
      ref={ref}
      src={url}
      poster={poster || undefined}
      controls={!autoplay}
      muted={autoplay}
      loop={autoplay}
      playsInline
      preload="none"
      className="absolute inset-0 h-full w-full"
      style={{ objectFit }}
    />
  );
}

// ── YouTube / Vimeo privacy facade ─────────────────────────────────────────────────

function EmbedFacade({
  source, id, poster, autoplay, isActive,
}: {
  source: "youtube" | "vimeo"; id: string; poster?: string; autoplay: boolean; isActive: boolean;
}) {
  const [userLoaded, setUserLoaded] = useState(false);

  // The iframe only exists while the slide is active AND playback was requested
  // (autoplay, or a click). Unmounting on inactive pauses playback.
  const shouldLoad = (autoplay || userLoaded) && isActive;

  const src = source === "youtube"
    ? youtubeEmbedSrc(id, { autoplay: true })
    : vimeoEmbedSrc(id, { autoplay: true });

  // No poster set → fall back to the platform default (YouTube's own thumbnail).
  const posterSrc = poster || (source === "youtube" && id ? youtubeThumbUrl(id) : undefined);

  if (shouldLoad && id) {
    return (
      <iframe
        src={src}
        title="Video"
        allow={MEDIA_IFRAME_ALLOW}
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setUserLoaded(true)}
      aria-label="Video afspelen"
      className="group absolute inset-0 h-full w-full cursor-pointer"
    >
      {posterSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- poster asset on any host
        <img src={posterSrc} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "#111827", marginLeft: 3 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
