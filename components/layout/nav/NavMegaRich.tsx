"use client";

/**
 * NavMegaRich — Column-based mega menu with per-theme visual variants
 *
 * ─── What this is ────────────────────────────────────────────────────────────
 *
 *   A flexible, schema-driven mega menu panel that replaces the simple children
 *   dropdown in NavMega when a `megaMenu.columns` configuration is present.
 *
 *   Columns can hold two content types:
 *     "links"  — vertical list of navigation links with optional descriptions
 *     "media"  — image / video / GIF cards with hover states
 *
 *   Column titles are optional: when a title is empty the heading is skipped
 *   and only the items are rendered.
 *
 * ─── Theme variants ───────────────────────────────────────────────────────────
 *
 *   The `megaStyle` prop selects the visual personality:
 *
 *   "dark-ai"          Near-black surface, subtle border, wider column spacing,
 *                      restrained motion, atmospheric hover glow on media items,
 *                      muted link typography with wide letter-spacing.
 *
 *   "clean-corporate"  Light white surface, soft shadow + border, clearly visible
 *                      column titles, readable link grouping with optional
 *                      descriptions, balanced spacing.  DEFAULT experience.
 *
 *   "structured-saas"  Tighter grid, compact link rows with hairline column
 *                      separators, efficient typography, product-screenshot
 *                      friendly media treatment.
 *
 *   "default"          Alias for "clean-corporate".
 *
 *   All three variants share the same underlying DOM structure and data model.
 *   Only CSS classes (spacing, border, typography, shadow, motion) differ.
 *   No hardcoded colors are used — all visual values reference CSS custom
 *   properties defined by the active theme preset.
 *
 * ─── Parent item clickability ─────────────────────────────────────────────────
 *
 *   The split-trigger pattern preserves full parent-item usability:
 *     • The parent label is a real <a> tag — clicking it navigates.
 *     • A separate chevron-only <button> opens / closes the mega panel.
 *   Both targets sit in a shared inline-flex row so they look like one item.
 *   This satisfies the requirement that parent nav items MUST remain clickable.
 *
 * ─── Hover reliability ────────────────────────────────────────────────────────
 *
 *   Same hover-bridge + close-delay strategy as the existing NavMega / NavFlyout:
 *   an invisible aria-hidden bridge div covers the gap between the trigger row
 *   and the panel so cursor movement never fires premature mouseleave.
 *
 * ─── Media hover states ───────────────────────────────────────────────────────
 *
 *   Per media item:
 *   • When `hoverAssetUrl` is set: cross-fade to that URL on cursor enter.
 *   • When absent: apply a CSS transform (scale + brightness) customised per
 *     megaStyle (dark-ai: glow + slight scale; clean-corporate: clean scale;
 *     structured-saas: minimal scale only).
 *   • Video items: play() on pointer enter, pause() on leave.
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
 *   NavMegaRich is desktop-only (hidden md:flex).  MobileNav in NavBar handles
 *   mobile rendering, flattening megaMenu columns into an expandable list.
 *
 * ─── Server only in data, client in interaction ──────────────────────────────
 *
 *   Data is resolved by the server (Header RSC) and passed as props.
 *   This component is "use client" only for open/close state and pointer events.
 */

import { useState, useRef, useCallback, useLayoutEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  NavigationItemData,
  MegaMenuData,
  MegaMenuColumnData,
  MegaMenuLinkItemData,
  MegaMenuMediaItemData,
  MegaMenuCtaData,
} from "@/cms/types";
import { useMenuState } from "./useMenuState";

// ── Mega menu style variants ──────────────────────────────────────────────────

/**
 * Visual personality for the mega menu panel.
 *
 * Derived in Header from the active theme family key:
 *   "dark-ai"         ← family: "dark-ai"
 *   "clean-corporate" ← family: "clean-corporate"
 *   "structured-saas" ← family: "structured-saas"
 *   "default"         ← all other families (equivalent to clean-corporate)
 */
export type MegaMenuStyle =
  | "dark-ai"
  | "clean-corporate"
  | "structured-saas"
  | "default";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Style configs ─────────────────────────────────────────────────────────────

/**
 * Per-variant style tokens.
 * All values map to Tailwind utility classes or CSS custom properties —
 * never hardcoded color values.
 */
const STYLE_CONFIG = {
  "dark-ai": {
    // Panel shell
    panel:       "bg-[var(--nav-dropdown-bg,#0d0d12)] border border-[var(--nav-dropdown-border,rgba(255,255,255,0.08))] shadow-xl",
    panelPadding: "p-6",
    // Column grid
    colGap:      "gap-x-8 gap-y-0",
    colSeparator: false,
    // Column title
    colTitleSize: "text-[10px] font-semibold uppercase tracking-[0.15em]",
    colTitleColor: "text-[var(--text-muted,rgba(255,255,255,0.35))]",
    colTitleMb:   "mb-3",
    // Links
    linkPy:       "py-2",
    linkText:     "text-[var(--nav-dropdown-text,rgba(255,255,255,0.65))]",
    linkHover:    "hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))] hover:bg-transparent",
    linkDesc:     "text-[var(--text-muted,rgba(255,255,255,0.35))]",
    linkTracking: "tracking-wide",
    // Media
    mediaBg:      "bg-[var(--nav-dropdown-bg,rgba(255,255,255,0.04))]",
    mediaRadius:  "rounded-lg",
    mediaPadding: "p-3",
    // Caption
    captionColor: "text-[var(--text-muted,rgba(255,255,255,0.45))]",
    captionSize:  "text-[11px]",
    captionMt:    "mt-2",
    // Hover animation on media (when no hoverAsset)
    mediaHoverClass: "hover:brightness-110 hover:scale-[1.02]",
  },

  "clean-corporate": {
    // Panel shell
    panel:       "bg-[var(--nav-dropdown-bg,#ffffff)] border border-[var(--nav-dropdown-border,var(--border))] shadow-md",
    panelPadding: "p-5",
    // Column grid
    colGap:      "gap-x-6 gap-y-0",
    colSeparator: true,
    // Column title
    colTitleSize: "text-[11px] font-semibold uppercase tracking-wider",
    colTitleColor: "text-[var(--text,#1e293b)]",
    colTitleMb:   "mb-2.5",
    // Links
    linkPy:       "py-1.5",
    linkText:     "text-[var(--nav-dropdown-text,var(--text-muted))]",
    linkHover:    "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
    linkDesc:     "text-[var(--text-muted)]",
    linkTracking: "",
    // Media
    mediaBg:      "bg-[var(--bg-subtle,#f8fafc)]",
    mediaRadius:  "rounded-md",
    mediaPadding: "p-2",
    // Caption
    captionColor: "text-[var(--text-muted)]",
    captionSize:  "text-xs",
    captionMt:    "mt-1.5",
    // Hover animation on media (when no hoverAsset)
    mediaHoverClass: "hover:scale-[1.03] hover:shadow-sm",
  },

  "structured-saas": {
    // Panel shell
    panel:       "bg-[var(--nav-dropdown-bg,#fafaf8)] border border-[var(--nav-dropdown-border,var(--border))] shadow-sm",
    panelPadding: "p-4",
    // Column grid
    colGap:      "gap-x-4 gap-y-0",
    colSeparator: true,
    // Column title
    colTitleSize: "text-[10px] font-bold uppercase tracking-[0.12em]",
    colTitleColor: "text-[var(--text-muted)]",
    colTitleMb:   "mb-2",
    // Links
    linkPy:       "py-1",
    linkText:     "text-[var(--nav-dropdown-text,var(--text-muted))]",
    linkHover:    "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
    linkDesc:     "text-[var(--text-muted)]",
    linkTracking: "",
    // Media
    mediaBg:      "bg-[var(--bg-subtle,#f1f5f9)]",
    mediaRadius:  "rounded",
    mediaPadding: "p-1.5",
    // Caption
    captionColor: "text-[var(--text-muted)]",
    captionSize:  "text-[11px]",
    captionMt:    "mt-1",
    // Hover animation on media (when no hoverAsset)
    mediaHoverClass: "hover:scale-[1.02]",
  },
} satisfies Record<string, Record<string, string | boolean>>;

// "default" is an alias for clean-corporate
STYLE_CONFIG["default" as "clean-corporate"] = STYLE_CONFIG["clean-corporate"];

type StyleKey = keyof typeof STYLE_CONFIG;

function getStyle(style: MegaMenuStyle): typeof STYLE_CONFIG["clean-corporate"] {
  const key: StyleKey = (style in STYLE_CONFIG ? style : "clean-corporate") as StyleKey;
  return STYLE_CONFIG[key] as typeof STYLE_CONFIG["clean-corporate"];
}

// ── Link item ─────────────────────────────────────────────────────────────────

function MegaLinkItem({
  item,
  s,
  density,
}: {
  item:    MegaMenuLinkItemData;
  s:       ReturnType<typeof getStyle>;
  density: "compact" | "comfortable";
}) {
  const itemSize = density === "compact" ? "text-[0.8125rem]" : "text-sm";

  return (
    <Link
      href={item.href}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
      className={cn(
        "group block rounded-md px-3",
        s.linkPy,
        itemSize,
        s.linkText,
        s.linkHover,
        s.linkTracking,
        "transition-colors duration-100",
        "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1",
      )}
    >
      <span className="font-medium leading-snug">{item.label}</span>
      {item.description && (
        <span
          className={cn(
            "block mt-0.5 text-[11px] leading-snug",
            s.linkDesc,
          )}
        >
          {item.description}
        </span>
      )}
    </Link>
  );
}

// ── Media item ────────────────────────────────────────────────────────────────

function MegaMediaItem({
  item,
  s,
  megaStyle,
}: {
  item:      MegaMenuMediaItemData;
  s:         ReturnType<typeof getStyle>;
  megaStyle: MegaMenuStyle;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {/* autoplay blocked */});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Resolve the visible asset URL:
  //   - On hover, show hoverAssetUrl when set (image / gif items only)
  //   - Otherwise show assetUrl
  const displayUrl =
    isHovered && item.hoverAssetUrl && item.mediaType !== "video"
      ? item.hoverAssetUrl
      : item.assetUrl;

  // CSS hover animation class applied to the media container when NO hoverAsset
  // is configured.  Each theme variant uses a slightly different motion style.
  const hoverAnimClass =
    !item.hoverAssetUrl && item.mediaType !== "video"
      ? s.mediaHoverClass
      : "";

  // Dark AI gets a glowing highlight ring on hover for atmospheric depth.
  const darkAiGlow =
    megaStyle === "dark-ai" && isHovered
      ? "ring-1 ring-[var(--text-brand,#8b5cf6)] ring-opacity-50"
      : "";

  // Detect YouTube embed URLs — they require <iframe>, not <video>.
  // Append autoplay + mute + loop so the clip plays silently on open.
  const isYouTube = item.videoUrl
    ? /youtube\.com\/embed\//i.test(item.videoUrl)
    : false;

  const youTubeSrc = isYouTube && item.videoUrl
    ? (() => {
        const u = new URL(item.videoUrl);
        u.searchParams.set("autoplay", "1");
        u.searchParams.set("mute",     "1");
        u.searchParams.set("loop",     "1");
        u.searchParams.set("controls", "0");
        u.searchParams.set("modestbranding", "1");
        // loop requires playlist=VIDEO_ID
        const videoId = u.pathname.split("/").pop() ?? "";
        if (videoId) u.searchParams.set("playlist", videoId);
        return u.toString();
      })()
    : null;

  const mediaContent =
    item.mediaType === "video" && item.videoUrl ? (
      isYouTube && youTubeSrc ? (
        /* YouTube embed: iframe with autoplay + mute */
        <iframe
          src={youTubeSrc}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full"
          style={{ border: 0, display: "block" }}
          aria-label={item.alt ?? undefined}
        />
      ) : (
        /* Direct video file: autoplay muted loop */
        <video
          ref={videoRef}
          src={item.videoUrl}
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          aria-label={item.alt ?? undefined}
        />
      )
    ) : displayUrl ? (
      /* Image / GIF — swap src on hover when hoverAssetUrl is set */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={displayUrl}
        alt={item.alt ?? ""}
        className={cn(
          "w-full h-full object-cover",
          // When hoverAsset is configured, cross-fade between urls via opacity
          item.hoverAssetUrl ? "transition-opacity duration-200" : "",
        )}
      />
    ) : (
      /* No asset — show a neutral placeholder */
      <div className="w-full h-full bg-[var(--bg-subtle,#f1f5f9)] flex items-center justify-center">
        <span className="text-[var(--text-muted)] text-xs">No asset</span>
      </div>
    );

  const mediaBox = (
    <div
      className={cn(
        "relative overflow-hidden",
        // Aspect ratio: tall for dark-ai (atmospheric), standard for others
        megaStyle === "dark-ai" ? "aspect-[4/3]" : "aspect-[16/9]",
        s.mediaBg,
        s.mediaRadius,
        s.mediaPadding,
        // No-hoverAsset animation
        hoverAnimClass,
        // Dark AI hover ring
        darkAiGlow,
        "transition-all duration-200",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {mediaContent}
    </div>
  );

  const wrapper = item.linkUrl ? (
    <Link
      href={item.linkUrl}
      target={item.linkOpenInNewTab ? "_blank" : undefined}
      rel={item.linkOpenInNewTab ? "noopener noreferrer" : undefined}
      className="block group focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
    >
      {mediaBox}
      {item.caption && (
        <p
          className={cn(
            s.captionColor,
            s.captionSize,
            s.captionMt,
            "leading-snug",
          )}
        >
          {item.caption}
        </p>
      )}
    </Link>
  ) : (
    <div>
      {mediaBox}
      {item.caption && (
        <p
          className={cn(
            s.captionColor,
            s.captionSize,
            s.captionMt,
            "leading-snug",
          )}
        >
          {item.caption}
        </p>
      )}
    </div>
  );

  return wrapper;
}

// ── Column ────────────────────────────────────────────────────────────────────

function MegaColumn({
  column,
  s,
  density,
  megaStyle,
  showSeparator,
}: {
  column:        MegaMenuColumnData;
  s:             ReturnType<typeof getStyle>;
  density:       "compact" | "comfortable";
  megaStyle:     MegaMenuStyle;
  showSeparator: boolean;
}) {
  if (column.items.length === 0) return null;

  const isLinks = column.columnType === "links";

  return (
    <div
      className={cn(
        "flex flex-col",
        showSeparator &&
          "border-l border-[var(--nav-dropdown-border,var(--border))] pl-4 first:border-l-0 first:pl-0",
      )}
    >
      {/* Column title — only rendered when non-empty */}
      {column.title && column.title.trim() !== "" && (
        <p
          className={cn(
            s.colTitleSize,
            s.colTitleColor,
            s.colTitleMb,
          )}
        >
          {column.title}
        </p>
      )}

      {/* Items */}
      {isLinks ? (
        <ul className="flex flex-col gap-0">
          {column.items.map((item) => {
            if (item.type !== "megaMenuLinkItem") return null;
            return (
              <li key={item._key}>
                <MegaLinkItem item={item} s={s} density={density} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            // Media columns: 1 or 2 items per row
            column.items.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {column.items.map((item) => {
            if (item.type !== "megaMenuMediaItem") return null;
            return (
              <MegaMediaItem
                key={item._key}
                item={item}
                s={s}
                megaStyle={megaStyle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CTA block ─────────────────────────────────────────────────────────────────

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

/**
 * Promotional CTA inside a mega menu.
 *
 *   variant "card" — used for position "left" / "right": vertical card with an
 *                    optional image on top and a brand-coloured text block beneath.
 *   variant "bar"  — used for position "bottom": full-width horizontal bar.
 *
 * Colours come from theme tokens (--primary / --primary-text), never hardcoded.
 */
function MegaCta({ cta }: { cta: MegaMenuCtaData }) {
  const isBar = cta.position === "bottom";

  const brandBlock =
    "bg-[var(--primary,var(--btn-bg,#1a2b88))] text-[var(--primary-text,#ffffff)]";

  const arrowOrLabel = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-sm">
      {cta.ctaLabel ? <span>{cta.ctaLabel}</span> : null}
      <span className="inline-flex size-7 items-center justify-center rounded-md bg-[var(--primary-text,#ffffff)]/15 transition-colors group-hover:bg-[var(--primary-text,#ffffff)]/25">
        <ArrowRight />
      </span>
    </span>
  );

  if (isBar) {
    // ── Full-width bar (position: bottom) ────────────────────────────────────
    return (
      <Link
        href={cta.href}
        target={cta.openInNewTab ? "_blank" : undefined}
        rel={cta.openInNewTab ? "noopener noreferrer" : undefined}
        className={cn(
          "group flex items-center gap-4 rounded-lg p-4",
          brandBlock,
          "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
        )}
      >
        {cta.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cta.imageUrl}
            alt={cta.imageAlt ?? ""}
            className="h-14 w-20 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="font-bold leading-snug">{cta.heading}</span>
          {cta.text && <span className="text-sm leading-snug opacity-90">{cta.text}</span>}
        </div>
        <span className="ml-auto">{arrowOrLabel}</span>
      </Link>
    );
  }

  // ── Vertical card (position: left / right) ─────────────────────────────────
  return (
    <Link
      href={cta.href}
      target={cta.openInNewTab ? "_blank" : undefined}
      rel={cta.openInNewTab ? "noopener noreferrer" : undefined}
      className={cn(
        "group flex w-[260px] shrink-0 flex-col overflow-hidden rounded-lg",
        "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
      )}
    >
      {cta.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--bg-subtle,#f1f5f9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cta.imageUrl}
            alt={cta.imageAlt ?? ""}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className={cn("flex flex-1 flex-col gap-1.5 p-4", brandBlock)}>
        <span className="font-bold leading-snug">{cta.heading}</span>
        {cta.text && <span className="text-sm leading-snug opacity-90">{cta.text}</span>}
        <span className="mt-auto pt-3">{arrowOrLabel}</span>
      </div>
    </Link>
  );
}

// ── Simple dropdown panel ──────────────────────────────────────────────────────
//
// Compact vertical list of the item's child links. Used when a nav item's
// `dropdownStyle` is "simple" — a plain dropdown instead of the rich mega panel.

function SimpleDropdownPanel({
  item,
  s,
}: {
  item: NavigationItemData;
  s:    ReturnType<typeof getStyle>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect     = el.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 8);
    if (overflow > 0) el.style.transform = `translateX(${-overflow}px)`;
  }, []);

  const children = item.children ?? [];
  if (children.length === 0) return null;

  return (
    <div
      ref={panelRef}
      role="menu"
      className={cn("absolute left-0 top-full z-50 mt-px rounded-xl p-2", s.panel)}
      style={{ width: 256 }}
    >
      <ul className="flex flex-col">
        {children.map((child) => (
          <li key={child.id}>
            <Link
              href={child.href}
              role="menuitem"
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noopener noreferrer" : undefined}
              className={cn(
                "group block rounded-md px-3 py-2 text-sm",
                s.linkText,
                s.linkHover,
                "transition-colors duration-100",
                "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1",
              )}
            >
              <span className="font-medium leading-snug">{child.label}</span>
              {child.description && (
                <span className={cn("block mt-0.5 text-[11px] leading-snug", s.linkDesc)}>
                  {child.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Mega panel ────────────────────────────────────────────────────────────────

function MegaPanel({
  megaMenu,
  s,
  density,
  megaStyle,
}: {
  megaMenu:  MegaMenuData;
  s:         ReturnType<typeof getStyle>;
  density:   "compact" | "comfortable";
  megaStyle: MegaMenuStyle;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "";
    const rect     = el.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 8);
    if (overflow > 0) el.style.transform = `translateX(${-overflow}px)`;
  });

  const visibleColumns = megaMenu.columns.filter((c) => c.items.length > 0);
  const cta       = megaMenu.cta ?? null;
  const sideCta   = cta && (cta.position === "left" || cta.position === "right") ? cta : null;
  const bottomCta = cta && cta.position === "bottom" ? cta : null;
  if (visibleColumns.length === 0 && !cta) return null;

  // Panel width scales with column count, capped to avoid over-stretching.
  // dark-ai gets wider columns (media-forward); structured-saas tighter.
  const colWidth =
    megaStyle === "dark-ai"         ? 240 :
    megaStyle === "structured-saas" ? 180 :
    210;

  const colsWidth = Math.min(
    visibleColumns.length * colWidth,
    megaStyle === "dark-ai" ? 800 : 720,
  );
  // A side CTA card (~260px) plus its gap widens the panel.
  const panelWidth = colsWidth + (sideCta ? 280 : 0);

  return (
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "absolute left-0 top-full z-50 mt-px",
        "rounded-xl",
        s.panel,
        s.panelPadding,
      )}
      style={{ width: panelWidth }}
    >
      <div className="flex flex-col gap-4">
        {/* Columns row — with an optional CTA card on the left or right. */}
        <div className="flex items-stretch gap-5">
          {sideCta?.position === "left" && <MegaCta cta={sideCta} />}

          {visibleColumns.length > 0 && (
            <div
              className={cn("grid", s.colGap)}
              style={{
                width:               colsWidth,
                gridTemplateColumns: `repeat(${visibleColumns.length}, 1fr)`,
              }}
            >
              {visibleColumns.map((col, idx) => (
                <MegaColumn
                  key={col._key}
                  column={col}
                  s={s}
                  density={density}
                  megaStyle={megaStyle}
                  showSeparator={(s.colSeparator as boolean) && idx > 0}
                />
              ))}
            </div>
          )}

          {sideCta?.position === "right" && <MegaCta cta={sideCta} />}
        </div>

        {/* Full-width CTA bar under the columns. */}
        {bottomCta && <MegaCta cta={bottomCta} />}
      </div>
    </div>
  );
}

// ── Rich mega item (top-level trigger) ────────────────────────────────────────

interface RichMegaItemProps {
  item:      NavigationItemData;
  density:   "compact" | "comfortable";
  megaStyle: MegaMenuStyle;
}

function RichMegaItem({ item, density, megaStyle }: RichMegaItemProps) {
  const {
    open,
    setOpen,
    triggerRef,
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handleKeyDown,
  } = useMenuState();

  const s = getStyle(megaStyle);

  const linkPy = density === "compact" ? "py-2" : "py-2.5";

  const navLinkStyle: React.CSSProperties = {
    fontSize:      "var(--nav-link-size, 0.875rem)",
    fontWeight:    "var(--nav-link-weight, 500)",
    letterSpacing: "var(--nav-link-tracking, normal)",
  };

  // Dark AI: top-level links use wider letter-spacing for premium feel
  const darkAiTracking: React.CSSProperties =
    megaStyle === "dark-ai" ? { letterSpacing: "0.03em" } : {};

  const hasMegaMenu = Boolean(item.megaMenu?.columns?.length);
  const hasChildren = Boolean(item.children?.length);
  const hasDropdown = hasMegaMenu || hasChildren;

  const linkClass = cn(
    "inline-flex items-center rounded-l-md px-3",
    linkPy,
    "text-[var(--nav-link,var(--header-fg,var(--text)))]",
    "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
  );

  if (!hasDropdown) {
    // Simple link — no trigger button needed
    return (
      <Link
        href={item.href}
        target={item.openInNewTab ? "_blank" : undefined}
        rel={item.openInNewTab ? "noopener noreferrer" : undefined}
        style={{ ...navLinkStyle, ...darkAiTracking }}
        className={cn(linkClass, "rounded-md")}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {/*
       * Split trigger: the label navigates; the chevron toggles the panel.
       * This preserves full parent-item clickability as required.
       */}
      <div className="inline-flex items-stretch">
        {/* Parent page link — navigates; does NOT open the mega panel */}
        <Link
          href={item.href}
          target={item.openInNewTab ? "_blank" : undefined}
          rel={item.openInNewTab ? "noopener noreferrer" : undefined}
          style={{ ...navLinkStyle, ...darkAiTracking }}
          className={linkClass}
        >
          {item.label}
        </Link>

        {/* Chevron-only toggle — does NOT navigate */}
        <button
          ref={triggerRef}
          aria-label={`Toggle ${item.label} submenu`}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={navLinkStyle}
          className={cn(
            "inline-flex items-center rounded-r-md pl-0.5 pr-2",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
          )}
        >
          <ChevronDown
            className={cn(
              "transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && (
        <>
          {/* Hover bridge — prevents premature menu close while cursor traverses the gap */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-full z-40 h-1 w-full"
          />

          {item.dropdownStyle === "simple" ? (
            // Per-item "simple" style — a compact dropdown list, not a mega panel.
            <SimpleDropdownPanel item={item} s={s} />
          ) : hasMegaMenu && item.megaMenu ? (
            // Rich column mega menu
            <MegaPanel
              megaMenu={item.megaMenu}
              s={s}
              density={density}
              megaStyle={megaStyle}
            />
          ) : (
            // Legacy children mega panel (feature columns + optional CTA)
            <LegacyChildrenPanel
              item={item}
              s={s}
              density={density}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Legacy children fallback panel ────────────────────────────────────────────
//
// Renders a feature-column layout for items that have `children` but no
// `megaMenu.columns` configuration.  The parent item label is intentionally
// NOT repeated here (it is already visible as the nav trigger above the panel).
//
// Layout:
//   ┌────────────┬────────────┬────────────┐
//   │  Child 1   │  Child 2   │  Child 3   │
//   │  (title)   │  (title)   │  (title)   │
//   │  desc …    │  desc …    │  desc …    │
//   │  ›         │  ›         │  ›         │
//   └────────────┴────────────┴────────────┘

function LegacyChildrenPanel({
  item,
  s,
}: {
  item:    NavigationItemData;
  s:       ReturnType<typeof getStyle>;
  density: "compact" | "comfortable";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Overflow correction — runs synchronously before paint so there's no flash.
  // The panel is only mounted when the menu is open (conditional render in
  // RichMegaItem), so [] runs exactly once per open: on the initial mount.
  // If the panel's right edge would exceed the viewport, shift it left by the
  // overflow amount so it stays fully visible.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect     = el.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 8); // 8px breathing room
    if (overflow > 0) el.style.transform = `translateX(${-overflow}px)`;
  }, []);

  const children = item.children ?? [];
  if (children.length === 0) return null;

  // Respect per-item show/hide flags — absent (undefined) defaults to true.
  const showImages       = item.megaShowImage       !== false;
  const showDescriptions = item.megaShowDescription !== false;

  const hasAnyDesc  = showDescriptions && children.some((c) => c.description);
  const hasAnyImage = showImages       && children.some((c) => c.imageUrl);

  // Optional promotional CTA (path-independent — lives on the nav item itself).
  const cta       = item.megaCta ?? null;
  const sideCta   = cta && (cta.position === "left" || cta.position === "right") ? cta : null;
  const bottomCta = cta && cta.position === "bottom" ? cta : null;

  // Panel width: per-column width × count, capped at 920px (+ a side CTA card).
  const colW      = hasAnyImage ? 220 : hasAnyDesc ? 230 : 200;
  const childrenW = Math.min(children.length * colW, 920);
  const panelW    = childrenW + (sideCta ? 280 : 0);

  return (
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "absolute left-0 top-full z-50 mt-px",
        "max-w-[90vw] overflow-hidden rounded-xl",
        s.panel,
        cta && "p-3",
      )}
      style={{ width: panelW }}
    >
     <div className="flex flex-col gap-3">
      {/* Columns row — with an optional CTA card on the left or right. */}
      <div className="flex items-stretch gap-3">
        {sideCta?.position === "left" && <MegaCta cta={sideCta} />}
      {/* ── Feature columns — one per child, separated by hairline dividers ── */}
      <div
        className="flex flex-1 divide-x divide-[var(--nav-dropdown-border,var(--border))]"
        style={{ width: childrenW }}
      >
          {children.map((child) => (
            <Link
              key={child.id}
              href={child.href}
              role="menuitem"
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noopener noreferrer" : undefined}
              className={cn(
                "group flex flex-col gap-1.5 p-5 flex-1 min-w-0",
                "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1",
              )}
            >
              {/* Thumbnail — only when enabled and overview_image is set on the page */}
              {showImages && child.imageUrl && (
                <div className="relative aspect-video w-full rounded-md overflow-hidden mb-1 bg-[var(--bg-subtle,#f1f5f9)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={child.imageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  {/* Hover image (overview_image_hover) — cross-fades in on hover. */}
                  {child.imageUrlHover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={child.imageUrlHover}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                  )}
                </div>
              )}
              <span
                className={cn(
                  "font-semibold text-sm leading-snug",
                  "text-[var(--nav-dropdown-text,var(--text))]",
                  "group-hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                  "transition-colors duration-100",
                )}
              >
                {child.label}
              </span>
              {showDescriptions && child.description && (
                <span className={cn("text-xs leading-relaxed line-clamp-3", s.linkDesc)}>
                  {child.description}
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 text-xs font-semibold",
                  "text-[var(--text-brand)]",
                  "group-hover:underline transition-colors duration-100",
                )}
              >
                Ontdekken ›
              </span>
            </Link>
          ))}
      </div>
        {sideCta?.position === "right" && <MegaCta cta={sideCta} />}
      </div>

      {/* Full-width CTA bar under the columns. */}
      {bottomCta && <MegaCta cta={bottomCta} />}
     </div>
    </div>
  );
}

// ── NavMegaRich ───────────────────────────────────────────────────────────────

export interface NavMegaRichProps {
  items:      NavigationItemData[];
  density:    "compact" | "comfortable";
  /**
   * Visual personality derived from the active theme family.
   * Defaults to "clean-corporate".
   */
  megaStyle?: MegaMenuStyle;
}

/**
 * Desktop column-based mega menu.
 *
 * Renders only in the md+ breakpoint — hidden on mobile.
 * MobileNav in NavBar handles mobile rendering separately.
 */
export function NavMegaRich({ items, density, megaStyle = "clean-corporate" }: NavMegaRichProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
      {items.map((item) => (
        <RichMegaItem
          key={item.id}
          item={item}
          density={density}
          megaStyle={megaStyle}
        />
      ))}
    </nav>
  );
}
