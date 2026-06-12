/**
 * Shared types for the tenant admin panel.
 *
 * This file is intentionally NOT a "use server" module.  It contains only
 * TypeScript types that must be imported by both server actions (actions.ts)
 * and client components (e.g. CreateSitePanel, CmsProvisioningPanel,
 * DesignTokenEditor).
 *
 * ─── Why a separate file? ────────────────────────────────────────────────────
 *
 *   Next.js / Turbopack treats "use server" modules specially: their only
 *   valid runtime exports are async server action functions.  Type-only
 *   re-exports (`export type { X }`) are erased at compile time and therefore
 *   do NOT exist at runtime.  When a client component imports a type from a
 *   "use server" module, Turbopack throws:
 *
 *     "Export <X> doesn't exist in target module"
 *
 *   Moving types here keeps them available to both sides without triggering
 *   that constraint.
 */

// ── Starter content ───────────────────────────────────────────────────────────

/**
 * Controls how starter content is written during tenant provisioning.
 *
 *   "fill"      — createIfNotExists: fills missing pages; existing content
 *                 is left unchanged.  Non-destructive default.
 *   "none"      — block stubs only (no dummy copy); always createOrReplace.
 *   "overwrite" — rich starter copy; always createOrReplace.  Destructive
 *                 on re-runs — replaces existing CMS content.
 *
 * Re-exported from @/cms/providers/cms-provider so client components can
 * import from this module without reaching into provider internals.
 */
export type { StarterContentMode } from "@/cms/providers/cms-provider";

// ── Font types ────────────────────────────────────────────────────────────────

/**
 * How a font role's typeface is sourced.
 *
 * "system"  — raw CSS font stack; no Google Font loading required.
 * "google"  — a supported Google Font from the pre-loaded set in lib/fonts.ts.
 * "custom"  — an uploaded woff2/woff file stored in Supabase Storage.
 */
export type FontSource = "system" | "google" | "custom";

/**
 * Which semantic font role is being targeted.
 *
 * "sans"  → --font-sans  (body/UI text)
 * "serif" → --font-serif (editorial/display text)
 * "mono"  → --font-mono  (code/pre)
 */
export type FontRole = "sans" | "serif" | "mono";

/**
 * Weight variants that can be uploaded for a custom font.
 */
export type CustomFontWeight = "regular" | "medium" | "bold" | "italic";

// ── Design token action results ───────────────────────────────────────────────

/**
 * Result type for applyDesignTokensAction.
 *
 *   ok: true  — tokens were validated and persisted; `appliedKeys` lists what
 *               changed (group names for grouped format, key names for legacy);
 *               `format` identifies which token format was used.
 *   ok: false — validation or save failed; `errors` explains why.
 */
export type ApplyTokensResult =
  | { ok: true;  appliedKeys: string[]; warnings: string[]; format: "legacy" | "grouped" }
  | { ok: false; errors: string[] };

/**
 * Fields the visual token editor can set or clear.
 *
 * ─── Semantics ────────────────────────────────────────────────────────────────
 *
 *   non-empty string — set this override (written to TenantDesignSettings.tokenOverrides)
 *   ""               — clear this override (removes the key, resetting to theme preset)
 *   undefined        — leave this override unchanged
 */
export interface VisualTokenFields {
  theme?: import("@/tenant/types").ThemeKey;

  // ── color group ─────────────────────────────────────────────────────────────
  colorPrimary?:           string;  // → color.primary
  colorPrimaryHover?:      string;  // → color.primaryHover (--primary-hover, button & link hover)
  colorSecondary?:         string;  // → color.secondary
  colorAccent?:            string;  // → color.accent
  colorBackground?:        string;  // → color.background
  colorForeground?:        string;  // → color.foreground
  colorMuted?:             string;  // → color.muted
  colorMutedForeground?:   string;  // → color.mutedForeground
  colorBorder?:            string;  // → color.border
  colorRing?:              string;  // → color.ring
  colorDestructive?:       string;  // → color.destructive
  colorCard?:              string;  // → color.card
  colorCardForeground?:    string;  // → color.cardForeground
  colorPopover?:           string;  // → color.popover
  colorPopoverForeground?: string;  // → color.popoverForeground

  // ── typography group ────────────────────────────────────────────────────────
  // Base font families
  fontSans?:        string;  // → typography.fontSans  (CSS font-family stack)
  fontMono?:        string;  // → typography.fontMono
  fontSerif?:       string;  // → typography.fontSerif
  baseFontSize?:    string;  // → typography.baseFontSize
  lineHeightBase?:  string;  // → typography.lineHeightBase
  // Font source — stored in typography.*Source; used by the editor UI only.
  // "system"  → plain CSS stack, no Google Font loading
  // "google"  → CSS stack starting with a supported Google Font
  // "custom"  → CSS stack referencing an uploaded custom font file
  fontSansSource?:  FontSource;  // → typography.fontSansSource
  fontSerifSource?: FontSource;  // → typography.fontSerifSource
  fontMonoSource?:  FontSource;  // → typography.fontMonoSource

  // Font role mappings — control WHICH base font family each usage role uses.
  // Values are CSS font-family stacks (same format as fontSans/fontSerif/fontMono).
  // Defaults: fontHeading → fontSans, fontBody → fontSans, fontUI → fontSans,
  //           fontCode → fontMono (see theme.css --font-heading/body/ui/code vars).
  fontHeading?:       string;       // → typography.fontHeading  (h1–h3)
  fontBody?:          string;       // → typography.fontBody     (p, li, blockquote)
  fontUI?:            string;       // → typography.fontUI       (button, label, nav)
  fontCode?:          string;       // → typography.fontCode     (code, pre, kbd)
  fontHeadingSource?: FontSource;   // → typography.fontHeadingSource

  // ── radius group ────────────────────────────────────────────────────────────
  radiusInteractive?: string;  // → radius.interactive
  radiusCard?:        string;  // → radius.card
  radiusPopover?:     string;  // → radius.popover
  radiusSm?:          string;  // → radius.sm
  radiusMd?:          string;  // → radius.md
  radiusLg?:          string;  // → radius.lg
  radiusFull?:        string;  // → radius.full

  // ── spacing group ───────────────────────────────────────────────────────────
  spacingBase?: string;  // → spacing.base
  spacingXs?:   string;  // → spacing.xs
  spacingSm?:   string;  // → spacing.sm
  spacingMd?:   string;  // → spacing.md
  spacingLg?:   string;  // → spacing.lg
  spacingXl?:   string;  // → spacing.xl
  spacing2xl?:  string;  // → spacing.2xl

  // ── border group ────────────────────────────────────────────────────────────
  borderWidth?:   string;  // → border.width
  borderWidthSm?: string;  // → border.widthSm
  borderWidthLg?: string;  // → border.widthLg
  borderColor?:   string;  // → border.color

  // ── shadow group ────────────────────────────────────────────────────────────
  shadowSm?:   string;  // → shadow.sm
  shadowMd?:   string;  // → shadow.md
  shadowLg?:   string;  // → shadow.lg
  shadowXl?:   string;  // → shadow.xl
  shadowNone?: string;  // → shadow.none

  // ── motion group ────────────────────────────────────────────────────────────
  motionDurationFast?:   string;  // → motion.durationFast
  motionDurationBase?:   string;  // → motion.durationBase
  motionDurationSlow?:   string;  // → motion.durationSlow
  motionEasingDefault?:  string;  // → motion.easingDefault
  motionEasingIn?:       string;  // → motion.easingIn
  motionEasingOut?:      string;  // → motion.easingOut
  motionEasingInOut?:    string;  // → motion.easingInOut

  // ── component group ─────────────────────────────────────────────────────────
  buttonRadius?:   string;  // → component.buttonRadius
  buttonPaddingX?: string;  // → component.buttonPaddingX
  buttonPaddingY?: string;  // → component.buttonPaddingY
  cardPadding?:    string;  // → component.cardPadding
  cardRadius?:     string;  // → component.cardRadius
  inputRadius?:    string;  // → component.inputRadius
  inputHeight?:    string;  // → component.inputHeight
  badgeRadius?:    string;  // → component.badgeRadius

  // ── layout group (header + footer shell) ────────────────────────────────────
  headerBg?:         string;  // → layout.headerBg         → --header-bg
  headerBgScrolled?: string;  // → layout.headerBgScrolled → --header-bg-scrolled
  headerFg?:         string;  // → layout.headerFg         → --header-fg
  headerBorder?:     string;  // → layout.headerBorder     → --header-border
  footerBg?:         string;  // → layout.footerBg         → --footer-bg
  footerFg?:         string;  // → layout.footerFg         → --footer-fg
  footerBorder?:     string;  // → layout.footerBorder     → --footer-border
}

export type SaveVisualTokensResult =
  | { ok: true;  warnings: string[] }
  | { ok: false; errors: string[] };

// ── CMS provisioning ──────────────────────────────────────────────────────────

/**
 * Result type for provisionSiteAction.
 *
 *   ok: true  — provisioning completed.
 *     documentIds     — Sanity document IDs written.
 *     pagesCreated    — page docs that didn't exist before.
 *     pagesUpdated    — page docs that already existed and were replaced.
 *     variantsWritten — total variant docs (hero/proof/cta) written.
 *     warnings        — non-fatal notes (e.g. fallback config sources used).
 *   ok: false — provisioning failed; `error` explains why.
 *               `partial` lists any document IDs written before the failure.
 */
export type ProvisionSiteResult =
  | {
      ok:                  true;
      documentIds:         string[];
      pagesCreated:        number;
      pagesUpdated:        number;
      variantsWritten:     number;
      siteSettingsWritten: boolean;
      navItemsWritten:     number;
      warnings:            string[];
    }
  | { ok: false; error: string; partial?: string[] };

// ── Site initialization ───────────────────────────────────────────────────────

/**
 * Per-page result within a createSiteAction run.
 *
 * status "created"  — page was newly created.
 * status "skipped"  — page already existed in the CMS and was left unchanged
 *                     (fill mode), or was intentionally omitted.
 * status "degraded" — page was created but some blocks were removed because
 *                     they are not in the tenant's package allow-list.
 *
 * pageId is optional: it is present for page-store–created pages, and absent
 * for CMS-provisioned pages (which have their own document IDs in the CMS).
 */
export interface CreateSitePageResult {
  title:           string;
  slug:            string;
  pageId?:         string;
  status:          "created" | "skipped" | "degraded";
  removedBlocks?:  string[];
}

/**
 * Status of a single initialization section.
 *
 *   ok      — section completed without issues.
 *   warn    — section completed but with non-fatal issues (see message/details).
 *   skipped — section had nothing to do (e.g. no domain configured yet).
 *   error   — section failed; the rest of initialization continued.
 */
export type SiteInitStatus = "ok" | "warn" | "skipped" | "error";

/** Status report for a single initialization section. */
export interface SiteInitSection {
  status:   SiteInitStatus;
  /** Short human-readable summary of what happened or why it was skipped/failed. */
  message?: string;
  /** Additional detail lines (integration status, block counts, etc.). */
  details?: string[];
}

/**
 * CMS content section — extends the base section with counts and page list.
 *
 * When the CMS path ran (real provider), `cmsDocumentIds` lists all document
 * IDs written.  When the page-store path ran (mock provider), `pages` carries
 * per-page results with edit links.
 */
export interface CmsInitSection extends SiteInitSection {
  pagesCreated?:        number;
  pagesUpdated?:        number;
  variantsWritten?:     number;
  siteSettingsWritten?: boolean;
  navItemsWritten?:     number;
  cmsDocumentIds?:      string[];
  /** Per-page status list — present on both CMS and page-store paths. */
  pages?:               CreateSitePageResult[];
}

/**
 * Per-section initialization report returned by createSiteAction.
 *
 * Each section independently records its outcome so the admin UI can show
 * a granular summary of what was initialized and what (if anything) needs
 * attention.
 */
export interface SiteInitReport {
  /** PART 1 — Tenant identity: name derived, packageKey validated. */
  tenantBase:   SiteInitSection;
  /** PART 2 — Design system: blocks.context, blocks.content, design.theme set. */
  designSystem: SiteInitSection;
  /** PART 3 + 4 + 6 — CMS pages, variant docs, and site settings provisioned. */
  cmsContent:   CmsInitSection;
  /** PART 7 — Integration baseline: CRM, enrichment, AI status recorded. */
  integrations: SiteInitSection;
  /** PART 8 — Domains baseline: primary domain status recorded. */
  domains:      SiteInitSection;
  /**
   * PART 6 (optional) — Blueprint-driven initialization via initializeSite().
   * Present only when blueprintKey + intake are passed to createSiteAction().
   * Covers tenant_sites row, DB pages, site_navigation, and interest profiles.
   */
  blueprint?:   SiteInitSection;
}

/**
 * Result type for createSiteAction.
 *
 *   ok: true  — initialization completed (individual sections may have warnings).
 *     report   — per-section status for admin feedback.
 *     warnings — aggregated non-fatal notes from all sections.
 *
 *   ok: false — action could not run at all; `error` explains why.
 *               Individual section errors do NOT produce ok:false — they are
 *               captured in the report and the action continues.
 */
export type CreateSiteResult =
  | {
      ok:       true;
      report:   SiteInitReport;
      warnings: string[];
    }
  | { ok: false; error: string };

// ── Statamic Forge deployment ─────────────────────────────────────────────────

/** Single step in a Forge deployment run. */
export interface DeployStatamicStep {
  step:     string;
  status:   "ok" | "warn" | "skipped" | "failed";
  message?: string;
}

/**
 * Result type for deployStatamicSiteAction.
 *
 *   ok: true  — all steps completed successfully.
 *     siteUrl      — the URL of the deployed Statamic site.
 *     forgeServerId / forgeSiteId — Forge references for future management.
 *     steps        — per-step log for admin feedback.
 *     warnings     — non-fatal notes.
 *
 *   ok: false — action failed at some step.
 *     error          — description of what failed.
 *     failedStep     — name of the step that failed.
 *     completedSteps — steps that DID complete before the failure.
 */
export type DeployStatamicResult =
  | {
      ok:            true;
      siteUrl:       string;
      forgeServerId: number;
      forgeSiteId:   number;
      steps:         DeployStatamicStep[];
      warnings:      string[];
    }
  | {
      ok:             false;
      error:          string;
      failedStep?:    string;
      completedSteps: DeployStatamicStep[];
    };
