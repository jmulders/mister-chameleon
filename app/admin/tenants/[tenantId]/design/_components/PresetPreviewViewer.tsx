"use client";

/**
 * PresetPreviewViewer
 *
 * Multi-page preview component for the admin theme gallery.  Replaces the
 * single-page `ThemeThumbnail` that only showed the homepage story.
 *
 * ─── Layout ──────────────────────────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────┐
 *   │  Home  │  Features  │            │  ← tab bar (hidden when 1 page)
 *   ├─────────────────────────────────┤
 *   │                                 │
 *   │   CSS mini-preview (fallback)   │
 *   │   Storybook iframe (overlaid)   │  ← preview area
 *   │                                 │
 *   └─────────────────────────────────┘
 *
 * ─── Lazy loading ────────────────────────────────────────────────────────────
 *
 *   Only the ACTIVE tab's iframe is mounted.  Switching tabs unmounts the
 *   previous iframe and mounts the new one — the new story loads fresh.
 *   The CSS mini-preview is always visible beneath the iframe, so the
 *   preview area never appears blank while the iframe is loading.
 *
 * ─── Fallback ────────────────────────────────────────────────────────────────
 *
 *   If the Storybook iframe fires an `onError` event (Storybook not running,
 *   or story ID doesn't exist) the iframe is hidden and the CSS mini-preview
 *   remains visible.  Subsequent tabs are tried independently — one missing
 *   story doesn't break the others.
 *
 * ─── Page resolution ─────────────────────────────────────────────────────────
 *
 *   Pages come from `THEME_CATALOG[preset].preview`.  When `preview` is absent
 *   (non-featured presets), a single "Home" page is synthesised:
 *     { id: "home", label: "Home", storyId: "themes-preview--{presetKey}" }
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   presetKey  ThemePresetKey  Which preset to preview.
 *   label      string          Human label for the iframe title attribute.
 *   height     number          Preview area height in px. Default: 180.
 *   showTabs   boolean         Whether to render the tab bar. Default: true.
 *                              Pass false for compact thumbnail mode (single tab).
 */

import { useState }             from "react";
import { THEME_CATALOG, THEME_PRESETS } from "@/design-system/theme/presets";
import type { ThemePresetKey, PresetPreviewPage } from "@/design-system/theme/presets";
import { tenantThemeToVarsRecord }   from "@/design-system/theme";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORYBOOK_URL =
  process.env.NEXT_PUBLIC_STORYBOOK_URL ?? "http://localhost:6006";

/**
 * Only attempt to load Storybook iframes when a real (non-localhost) URL is
 * configured.  Without this guard, browsers that enforce Local Network access
 * permissions (Safari on iOS/macOS) show a permission dialog on every page
 * load when NEXT_PUBLIC_STORYBOOK_URL is unset in production.
 */
const STORYBOOK_ENABLED =
  !STORYBOOK_URL.includes("localhost") &&
  !STORYBOOK_URL.includes("127.0.0.1");

/** Natural iframe dimensions the Storybook story renders at. */
const IFRAME_W = 1280;
const IFRAME_H = 900;

/** Card thumbnail target width — preview area fills this width. */
const THUMB_W  = 256;

/** Default preview area height. */
const DEFAULT_H = 180;

const SCALE = THUMB_W / IFRAME_W; // 0.2

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the resolved preview pages for a given preset.
 * Falls back to a single "Home" page when the catalog entry has no `preview`.
 */
function resolvePages(presetKey: ThemePresetKey): readonly PresetPreviewPage[] {
  const entry = THEME_CATALOG.find((e) => e.presetKey === presetKey);
  if (entry?.preview && entry.preview.length > 0) return entry.preview;
  // Default: single home page using the existing per-preset story ID.
  return [{ id: "home", label: "Home", storyId: `themes-preview--${presetKey}` }];
}

// ── CSS Mini-preview (fallback) ────────────────────────────────────────────────
//
// A self-contained CSS mini-preview so this component carries no dependency on
// the preset gallery. Shows key visual tokens (hero colour, primary, card
// radius, CTA) as a
// simple three-strip layout that differentiates themes visually.

interface MiniTokens {
  heroBg:       string;
  primary:      string;
  primaryText:  string;
  ctaBg:        string;
  featureBg:    string;
  cardBg:       string;
  cardBorder:   string;
  cardRadius:   string;
  titleColor:   string;
  btnRadius:    string;
}

function getMiniTokens(presetKey: ThemePresetKey): MiniTokens {
  const preset = THEME_PRESETS[presetKey] ?? THEME_PRESETS["modern-saas"];
  const v = tenantThemeToVarsRecord(preset);
  return {
    heroBg:      v["--hero-bg"]              ?? v["--bg-inverse"]          ?? "#0f172a",
    primary:     v["--primary"]              ?? "#6366f1",
    primaryText: v["--primary-text"]         ?? "#ffffff",
    ctaBg:       v["--section-cta-bg"]       ?? v["--primary"]             ?? "#6366f1",
    featureBg:   v["--feature-grid-bg"]      ?? v["--bg-subtle"]           ?? "#f8fafc",
    cardBg:      v["--card-bg"]              ?? "#ffffff",
    cardBorder:  v["--card-border"]          ?? "#e2e8f0",
    cardRadius:  v["--card-radius"]          ?? "0.5rem",
    titleColor:  v["--hero-title-color"]     ?? "#ffffff",
    btnRadius:   v["--btn-radius"]           ?? "0.375rem",
  };
}

function MiniPreview({ presetKey, height }: { presetKey: ThemePresetKey; height: number }) {
  const t = getMiniTokens(presetKey);
  const heroPct = "45%";
  const featPct = "35%";

  return (
    <div style={{
      width: `${THUMB_W}px`, height: `${height}px`,
      overflow: "hidden", display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Hero strip */}
      <div style={{
        flex: `0 0 ${heroPct}`, background: t.heroBg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "5px", padding: "8px 12px",
      }}>
        <div style={{ width: "40px", height: "5px", borderRadius: "3px", background: t.primary, opacity: 0.8 }} />
        <div style={{ width: "90px", height: "6px", borderRadius: "3px", background: t.titleColor, opacity: 0.9 }} />
        <div style={{ width: "70px", height: "4px", borderRadius: "3px", background: t.titleColor, opacity: 0.55 }} />
        <div style={{
          marginTop: "3px", padding: "3px 8px", borderRadius: t.btnRadius,
          background: t.primary, color: t.primaryText,
          fontSize: "5px", fontWeight: 700, whiteSpace: "nowrap",
        }}>
          Get started →
        </div>
      </div>

      {/* Feature grid strip */}
      <div style={{
        flex: `0 0 ${featPct}`, background: t.featureBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "5px", padding: "6px 10px",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            flex: 1, height: "44px",
            background: t.cardBg, border: `1px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius,
            display: "flex", flexDirection: "column",
            alignItems: "flex-start", justifyContent: "center",
            gap: "3px", padding: "4px 5px",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: t.primary, opacity: 0.7 }} />
            <div style={{ width: "90%", height: "3px", borderRadius: "2px", background: "#0f172a", opacity: 0.8 }} />
            <div style={{ width: "75%", height: "2px", borderRadius: "2px", background: "#0f172a", opacity: 0.35 }} />
          </div>
        ))}
      </div>

      {/* CTA strip */}
      <div style={{
        flex: "1", background: t.ctaBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "6px", padding: "4px 10px",
      }}>
        <div style={{ width: "60px", height: "5px", borderRadius: "3px", background: t.titleColor, opacity: 0.85 }} />
        <div style={{ padding: "3px 7px", borderRadius: "3px", background: t.cardBg, fontSize: "5px", fontWeight: 700, color: t.primary }}>
          Start free
        </div>
      </div>
    </div>
  );
}

// ── Single iframe layer ────────────────────────────────────────────────────────

interface IframeLayerProps {
  storyId: string;
  label:   string;
  height:  number;
}

function IframeLayer({ storyId, label, height }: IframeLayerProps) {
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);

  const src = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

  if (errored) return null;

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      opacity: loaded ? 1 : 0,
      transition: "opacity 0.35s ease",
      pointerEvents: "none",
    }}>
      <iframe
        src={src}
        title={label}
        aria-hidden="true"
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{
          width: `${IFRAME_W}px`,
          height: `${IFRAME_H}px`,
          border: "none",
          transformOrigin: "top left",
          transform: `scale(${SCALE})`,
          // Restrict iframe height to match the preview area after scaling.
          // Without clipping, the scaled 900px iframe bleeds below the container.
          maxHeight: `${height / SCALE}px`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

interface TabBarProps {
  pages:    readonly PresetPreviewPage[];
  activeId: string;
  onSelect: (id: string) => void;
}

function TabBar({ pages, activeId, onSelect }: TabBarProps) {
  return (
    <div style={{
      display: "flex", gap: "1px",
      background: "#f1f5f9",
      borderBottom: "1px solid #e2e8f0",
      overflow: "hidden",
    }}>
      {pages.map((page) => {
        const isActive = page.id === activeId;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelect(page.id)}
            style={{
              flex: 1,
              padding: "5px 8px",
              fontSize: "0.6875rem",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "#1d4ed8" : "#6b7280",
              background: isActive ? "#ffffff" : "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.1s ease, background 0.1s ease",
              textAlign: "center" as const,
              whiteSpace: "nowrap" as const,
            }}
          >
            {page.label}
          </button>
        );
      })}
    </div>
  );
}

// ── PresetPreviewViewer ────────────────────────────────────────────────────────

export interface PresetPreviewViewerProps {
  presetKey: ThemePresetKey;
  label:     string;
  /** Height of the preview area in pixels. Default: 180. */
  height?:   number;
  /**
   * Whether to show the tab bar when multiple pages are available.
   * Default: true.  Pass false to always render the first page only
   * (useful for compact thumbnail contexts where tabs would be too cramped).
   */
  showTabs?: boolean;
}

/**
 * Tabbed multi-page preview viewer for theme gallery cards and the sticky
 * preview panel.  Shows a CSS mini-preview as the always-visible base layer,
 * with a scaled Storybook iframe overlaid and faded in once loaded.
 */
export function PresetPreviewViewer({
  presetKey,
  label,
  height   = DEFAULT_H,
  showTabs = true,
}: PresetPreviewViewerProps) {
  const pages = resolvePages(presetKey);
  const [activeId, setActiveId] = useState(pages[0]?.id ?? "home");

  // Guard: if activeId is stale after a presetKey change, reset to first page.
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];

  const hasMultiplePages = pages.length > 1;
  const renderTabBar     = showTabs && hasMultiplePages;

  return (
    <div style={{ width: `${THUMB_W}px`, overflow: "hidden" }}>
      {/* Tab bar — only shown when multiple pages and showTabs=true */}
      {renderTabBar && (
        <TabBar
          pages={pages}
          activeId={activePage?.id ?? "home"}
          onSelect={setActiveId}
        />
      )}

      {/* Preview area */}
      <div style={{ position: "relative", width: `${THUMB_W}px`, height: `${height}px`, overflow: "hidden" }}>
        {/* Always-visible CSS mini-preview — base layer */}
        <MiniPreview presetKey={presetKey} height={height} />

        {/* Storybook iframe — overlaid per active page, lazy-mounted */}
        {STORYBOOK_ENABLED && activePage && (
          // Key on the storyId so React unmounts/remounts when the active tab changes.
          // This forces the new story to load fresh rather than reusing a stale iframe.
          <IframeLayer
            key={activePage.storyId}
            storyId={activePage.storyId}
            label={`${label} — ${activePage.label}`}
            height={height}
          />
        )}
      </div>
    </div>
  );
}
