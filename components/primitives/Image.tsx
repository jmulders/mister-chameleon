import { cn } from "@/lib/utils";

/**
 * Image
 *
 * A CMS-friendly responsive image atom.
 *
 * Renders a standard `<img>` element with sensible defaults (lazy loading,
 * responsive width, object-fit cover). An optional `aspectRatio` prop wraps
 * the image in an aspect-ratio container so the layout does not shift while
 * the image loads.
 *
 * ─── Why not Next.js <Image>? ─────────────────────────────────────────────────
 *
 *   Next.js <Image> requires either known dimensions or a `fill` parent, and
 *   restricts external domains unless configured in next.config. CMS image
 *   URLs can come from any CDN host (Sanity, Storyblok, Cloudinary, etc.) and
 *   may not carry dimension metadata. Using a plain <img> with explicit loading
 *   attributes gives full flexibility without requiring domain configuration.
 *
 *   This can be upgraded to Next.js Image at the call site or in this component
 *   once the CMS CDN domain is configured in next.config.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Simple — fills parent:
 *   <Image src={item.imageUrl} alt={item.title} className="h-full w-full" />
 *
 *   // With aspect-ratio container (prevents layout shift):
 *   <Image src={url} alt={alt} aspectRatio="video" />
 *
 *   // Custom fit + rounded corners:
 *   <Image src={url} alt={alt} aspectRatio="square" fit="contain" rounded="lg" />
 *
 * ─── Aspect ratios ────────────────────────────────────────────────────────────
 *
 *   video    → 16:9    (news/blog card thumbnails)
 *   square   → 1:1     (team photos, avatars)
 *   portrait → 3:4     (book covers, portrait photography)
 *   wide     → 21:9    (wide hero / banner)
 *   auto     → none    (no wrapper; image flows inline at natural size)
 *
 * ─── Fallback placeholder ─────────────────────────────────────────────────────
 *
 *   When `src` is empty or undefined the component renders a placeholder
 *   div with --section-subtle-bg background so the layout stays consistent.
 */

type AspectRatio = "video" | "square" | "portrait" | "wide" | "auto";
type ObjectFit   = "cover" | "contain" | "fill";
type RoundedSize = boolean | "sm" | "md" | "lg" | "xl" | "full";

export interface ImageProps {
  /** Image URL. When empty/undefined a placeholder is rendered. */
  src?:         string;
  /** Alt text. Required for accessibility. Pass "" for decorative images. */
  alt:          string;
  /**
   * Aspect-ratio wrapper for the image.
   * When "auto" (default) no wrapper is added — the image flows naturally.
   */
  aspectRatio?: AspectRatio;
  /** How the image fills its container. Defaults to "cover". */
  fit?:         ObjectFit;
  /**
   * Border-radius applied to the wrapper (or the img when no wrapper).
   *   true → rounded-lg (medium)
   *   "sm" | "md" | "lg" | "xl" | "full" → specific radius
   *   false | undefined → no radius
   */
  rounded?:     RoundedSize;
  /** Additional class names applied to the outer container when ratio is set. */
  className?:   string;
  /** Additional class names applied to the <img> element itself. */
  imgClassName?: string;
  /** Loading strategy. Defaults to "lazy". */
  loading?:     "lazy" | "eager";
  /** Inline styles applied to the outer wrapper. */
  style?:       React.CSSProperties;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const aspectClasses: Record<Exclude<AspectRatio, "auto">, string> = {
  video:    "aspect-video",
  square:   "aspect-square",
  portrait: "aspect-[3/4]",
  wide:     "aspect-[21/9]",
};

const fitClasses: Record<ObjectFit, string> = {
  cover:   "object-cover",
  contain: "object-contain",
  fill:    "object-fill",
};

const roundedClasses: Record<Exclude<RoundedSize, boolean | undefined>, string> = {
  sm:   "rounded-sm",
  md:   "rounded-md",
  lg:   "rounded-lg",
  xl:   "rounded-xl",
  full: "rounded-full",
};

function resolveRounded(rounded: RoundedSize | undefined): string {
  if (!rounded) return "";
  if (rounded === true) return "rounded-lg";
  return roundedClasses[rounded];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Image({
  src,
  alt,
  aspectRatio = "auto",
  fit        = "cover",
  rounded,
  className,
  imgClassName,
  loading = "lazy",
  style,
}: ImageProps) {
  const roundedClass = resolveRounded(rounded);

  // ── No aspect-ratio wrapper ────────────────────────────────────────────────
  if (aspectRatio === "auto") {
    if (!src) {
      return (
        <div
          className={cn("w-full", roundedClass, className)}
          style={{ backgroundColor: "var(--section-subtle-bg)", ...style }}
          role="presentation"
          aria-hidden="true"
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(fitClasses[fit], roundedClass, imgClassName, className)}
        style={style}
      />
    );
  }

  // ── With aspect-ratio wrapper ──────────────────────────────────────────────
  return (
    <div
      className={cn(
        "w-full overflow-hidden",
        aspectClasses[aspectRatio],
        roundedClass,
        className,
      )}
      style={{ backgroundColor: "var(--section-subtle-bg)", ...style }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={cn("h-full w-full", fitClasses[fit], imgClassName)}
        />
      )}
    </div>
  );
}
