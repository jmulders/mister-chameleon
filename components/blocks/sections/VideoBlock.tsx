/**
 * VideoBlock
 *
 * Renders a standalone `video` page section — a responsive 16:9 iframe embed
 * for YouTube, Vimeo, or a native `<video>` element for direct file URLs.
 *
 * The Statamic `video_block` fieldset accepts:
 *   title     → optional heading above the player
 *   video_url → YouTube ID / watch URL / embed URL, Vimeo URL, or native file URL
 *   thumbnail → optional poster image (native video only; YouTube ignores it)
 *
 * URL normalisation happens in the Statamic mapper, so `data.url` is always a
 * proper embed URL by the time it reaches this component.
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   contained   — centred, max 56rem, with side padding (default)
 *   full-width  — edge-to-edge, no horizontal padding
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg       Section background
 *   --card-radius      Embed border-radius
 *   --text-muted       Caption colour
 *   --font-heading     Heading font family
 */

import type { VideoBlockData } from "@/page-config";

interface VideoBlockProps {
  data:     VideoBlockData;
  variant?: string;
}

/**
 * Append autoplay/loop params to a YouTube/Vimeo embed URL.
 *
 * Embeds ignore the `autoPlay`/`loop` flags unless they are passed as query
 * params. Autoplay is only honoured by browsers when the player is muted, so we
 * force mute whenever autoplay is requested. YouTube loop additionally requires
 * `playlist=<videoId>` (a single-video playlist) to actually repeat.
 */
function buildEmbedSrc(
  url: string,
  platform: VideoBlockData["platform"],
  autoPlay?: boolean,
  loop?: boolean,
): string {
  if (!autoPlay && !loop) return url;
  try {
    const u = new URL(url);
    if (platform === "youtube") {
      if (autoPlay) { u.searchParams.set("autoplay", "1"); u.searchParams.set("mute", "1"); }
      if (loop) {
        u.searchParams.set("loop", "1");
        const id = u.pathname.split("/").pop();
        if (id) u.searchParams.set("playlist", id);
      }
    } else if (platform === "vimeo") {
      if (autoPlay) { u.searchParams.set("autoplay", "1"); u.searchParams.set("muted", "1"); }
      if (loop) u.searchParams.set("loop", "1");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function VideoBlock({ data, variant }: VideoBlockProps) {
  const isFullWidth = variant === "full-width";

  // ── Native <video> element ───────────────────────────────────────────────────
  if (data.platform === "native") {
    return (
      <section
        className="py-12"
        style={{ background: "var(--section-bg, transparent)" }}
      >
        <div className={isFullWidth ? "" : "mx-auto max-w-4xl px-6"}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={data.url}
            poster={data.posterUrl}
            autoPlay={data.autoPlay}
            loop={data.loop}
            muted={data.muted ?? data.autoPlay}
            controls={!data.autoPlay}
            playsInline
            style={{
              width:        "100%",
              borderRadius: "var(--card-radius, 0.5rem)",
              display:      "block",
            }}
          />
          {data.caption && (
            <p
              className="mt-3 text-sm text-center"
              style={{ color: "var(--text-muted, #6b7280)" }}
            >
              {data.caption}
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── Iframe embed (YouTube / Vimeo) ───────────────────────────────────────────
  return (
    <section
      className="py-12"
      style={{ background: "var(--section-bg, transparent)" }}
    >
      <div className={isFullWidth ? "" : "mx-auto max-w-4xl px-6"}>
        {/* 16:9 aspect-ratio wrapper */}
        <div
          style={{
            position:     "relative",
            paddingBottom: "56.25%",
            height:        0,
            overflow:      "hidden",
            borderRadius:  "var(--card-radius, 0.5rem)",
          }}
        >
          <iframe
            src={buildEmbedSrc(data.url, data.platform, data.autoPlay, data.loop)}
            title={data.caption ?? "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              position: "absolute",
              inset:    0,
              width:    "100%",
              height:   "100%",
              border:   "none",
            }}
          />
        </div>

        {data.caption && (
          <p
            className="mt-3 text-sm text-center"
            style={{ color: "var(--text-muted, #6b7280)" }}
          >
            {data.caption}
          </p>
        )}
      </div>
    </section>
  );
}
